# predict.py
"""
Tạo submission.csv từ checkpoint đã train.
Hỗ trợ single model và ensemble nhiều seeds.

Ví dụ:
    python predict.py --model nhits
    python predict.py --model nhits  --ensemble 5
    python predict.py --model all    --ensemble 3    # ensemble tất cả models
    python predict.py --model nhits  --params checkpoints/nhits_best_params.json
"""

import argparse
import os

import numpy as np
import pandas as pd
import torch

from configs.config import (
    GLOBAL_SEED, INPUT_SIZE, HORIZON, VAL_STEPS,
    CHECKPOINT_DIR, OUTPUT_DIR, MODEL_DEFAULTS,
    DEFAULT_BATCH_SIZE, DEFAULT_MAX_STEPS, DEFAULT_LR,
    DEFAULT_N_SEEDS_ENS,
)
from utils.data_loader import load_data
from utils.metrics import evaluate_model
from train import train, MODEL_REGISTRY

import json


def load_best_params(model_name: str) -> tuple[dict, dict]:
    """Load params từ checkpoint JSON nếu có, fallback về defaults."""
    path = os.path.join(CHECKPOINT_DIR, f"{model_name}_best_params.json")
    if os.path.exists(path):
        with open(path) as f:
            saved = json.load(f)
        params = saved.get("params", {})
        model_params = {**MODEL_DEFAULTS[model_name], **params}
        train_params = {
            "max_steps"   : params.get("max_steps",   DEFAULT_MAX_STEPS),
            "batch_size"  : params.get("batch_size",  DEFAULT_BATCH_SIZE),
            "lr"          : params.get("lr",           DEFAULT_LR),
            "weight_decay": params.get("weight_decay", 0.0),
        }
        wrmsse_val = saved.get("wrmsse")
        wrmsse_str = f"{wrmsse_val:.6f}" if isinstance(wrmsse_val, (int, float)) else "N/A"
        print(f"  Loaded best params from {path}  (WRMSSE={wrmsse_str})")
        return model_params, train_params
    else:
        print(f"  No checkpoint found for {model_name} — using defaults")
        return dict(MODEL_DEFAULTS[model_name]), {
            "max_steps"   : DEFAULT_MAX_STEPS,
            "batch_size"  : DEFAULT_BATCH_SIZE,
            "lr"          : DEFAULT_LR,
            "weight_decay": 0.0,
        }


def predict_one_model(model_name: str, series: np.ndarray,
                      profit_weights: np.ndarray, device: str,
                      model_params: dict, train_params: dict,
                      n_seeds: int) -> np.ndarray:
    """
    Train n_seeds models on FULL series (no val hold-out),
    return ensemble mean predictions  (N_skus, HORIZON).
    """
    print(f"\n  Training {model_name.upper()} × {n_seeds} seeds on full data ...")
    all_preds = []

    for s in range(n_seeds):
        tp = {**train_params, "seed": GLOBAL_SEED + s * 997}
        model = train(model_name, model_params, tp,
                      series, profit_weights, device, verbose=False,
                      full_train=True)

        model.eval()
        with torch.no_grad():
            inp    = torch.from_numpy(series[:, -INPUT_SIZE:]).to(device)
            chunks = []
            for i in range(0, inp.size(0), 512):
                chunks.append(model(inp[i:i+512]).cpu().numpy())
            preds = np.clip(np.concatenate(chunks, axis=0), 0, None)
        all_preds.append(preds)

        del model
        if device == "cuda":
            torch.cuda.empty_cache()
        print(f"    Seed {s+1}/{n_seeds} done")

    return np.mean(all_preds, axis=0)   # (N, HORIZON)


def build_submission(fc: np.ndarray, all_skus: list,
                     submission_template: pd.DataFrame,
                     output_path: str):
    """Build và validate submission DataFrame."""
    results = []
    for idx, sku in enumerate(all_skus):
        results.append([f"{sku}_validation"] + fc[idx, :28].tolist())
        results.append([f"{sku}_evaluation"] + fc[idx, 28:56].tolist())

    cols = ["id"] + [f"F{i}" for i in range(1, 29)]
    out  = pd.DataFrame(results, columns=cols)
    out  = out.set_index("id").loc[submission_template["id"]].reset_index()

    # Sanity checks
    assert (out.iloc[:, 1:].values >= 0).all(),       "❌ Negative values!"
    assert len(out) == len(submission_template),        "❌ Row count mismatch!"
    assert not out["id"].duplicated().any(),            "❌ Duplicate IDs!"

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"\n  ✓ Saved → {output_path}  |  shape: {out.shape}")
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",    type=str,  default="nhits",
                        choices=list(MODEL_REGISTRY.keys()) + ["all"])
    parser.add_argument("--ensemble", type=int,  default=DEFAULT_N_SEEDS_ENS,
                        help="Number of seeds to ensemble")
    parser.add_argument("--params",   type=str,  default=None,
                        help="Override params JSON path")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\nDevice: {device}")

    series, all_skus, submission_template, profit_weights = load_data()

    models_to_run = (list(MODEL_REGISTRY.keys())
                     if args.model == "all" else [args.model])

    all_forecasts = []

    for model_name in models_to_run:
        if args.params:
            with open(args.params) as f:
                saved = json.load(f)
            model_params = {**MODEL_DEFAULTS[model_name],
                            **saved.get("params", {})}
            train_params = {
                "max_steps"   : saved.get("params", {}).get("max_steps",   DEFAULT_MAX_STEPS),
                "batch_size"  : saved.get("params", {}).get("batch_size",  DEFAULT_BATCH_SIZE),
                "lr"          : saved.get("params", {}).get("lr",           DEFAULT_LR),
                "weight_decay": saved.get("params", {}).get("weight_decay", 0.0),
            }
        else:
            model_params, train_params = load_best_params(model_name)

        fc = predict_one_model(model_name, series, profit_weights, device,
                               model_params, train_params, args.ensemble)
        all_forecasts.append(fc)

        # Per-model submission file
        if len(models_to_run) > 1:
            path = os.path.join(OUTPUT_DIR, f"submission_{model_name}.csv")
            build_submission(fc, all_skus, submission_template, path)

    # Final (ensemble of all models if --model all)
    final_fc   = np.mean(all_forecasts, axis=0)
    suffix     = "ensemble_all" if args.model == "all" else args.model
    final_path = os.path.join(OUTPUT_DIR, f"submission_{suffix}.csv")
    build_submission(final_fc, all_skus, submission_template, final_path)
    print("\n✓ Done!")


if __name__ == "__main__":
    main()