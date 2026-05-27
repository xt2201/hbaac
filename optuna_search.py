# optuna_search.py
"""
Optuna hyperparameter search — minimize WRMSSE trên hold-out validation.

Ví dụ:
    python optuna_search.py --model nhits  --trials 50
    python optuna_search.py --model nbeats --trials 30
    python optuna_search.py --model tft    --trials 20
    python optuna_search.py --model all    --trials 20   # so sánh tất cả models
"""

import argparse
import json
import os

import numpy as np
import optuna
from optuna.samplers import TPESampler

import torch

from configs.config import (
    GLOBAL_SEED, INPUT_SIZE, HORIZON, VAL_STEPS,
    CHECKPOINT_DIR, SEARCH_SPACES, MODEL_DEFAULTS,
    NHITS_STACK_CONFIGS,
)
from utils.data_loader import load_data
from utils.metrics import evaluate_model, print_score
from train import train, MODEL_REGISTRY


optuna.logging.set_verbosity(optuna.logging.WARNING)


# ── Suggest helpers ───────────────────────────────────────────────────────────

def suggest_params(trial: optuna.Trial, model_name: str) -> tuple[dict, dict]:
    """
    Trả về (model_params, train_params) dựa trên SEARCH_SPACES trong config.
    """
    space = SEARCH_SPACES[model_name]
    model_params = dict(MODEL_DEFAULTS[model_name])   # defaults
    train_params = {}

    for key, spec in space.items():
        t = spec["type"]
        if t == "categorical":
            val = trial.suggest_categorical(key, spec["choices"])
        elif t == "int":
            val = trial.suggest_int(key, spec["low"], spec["high"])
        elif t == "float":
            val = trial.suggest_float(key, spec["low"], spec["high"],
                                       log=spec.get("log", False))
        else:
            raise ValueError(f"Unknown type: {t}")

        # Route to correct dict
        if key in ("batch_size", "max_steps", "lr", "weight_decay"):
            train_params[key] = val
        elif key == "stack_config":
            pk, fd = NHITS_STACK_CONFIGS[val]
            model_params["pool_kernels"]     = list(pk)
            model_params["freq_downsamples"] = list(fd)
        elif key == "loss":
            model_params["loss"] = val
            if val == "huber":
                model_params["huber_delta"] = trial.suggest_float(
                    "huber_delta", 0.5, 5.0)
        else:
            model_params[key] = val

    return model_params, train_params


# ── Objective factory ─────────────────────────────────────────────────────────

def make_objective(model_name: str, series: np.ndarray,
                   profit_weights: np.ndarray, device: str):
    def objective(trial: optuna.Trial) -> float:
        model_params, train_params = suggest_params(trial, model_name)
        train_params.setdefault("seed", GLOBAL_SEED + trial.number)

        model  = train(model_name, model_params, train_params,
                       series, profit_weights, device, verbose=False)
        result = evaluate_model(model, series, profit_weights, device)

        del model
        if device == "cuda":
            torch.cuda.empty_cache()

        # Store for analysis
        trial.set_user_attr("rmsse_mean", result["rmsse_mean"])
        trial.set_user_attr("rmsse_p90",  result["rmsse_p90"])

        return result["wrmsse"]   # minimize WRMSSE
    return objective


def run_study(model_name: str, series: np.ndarray,
              profit_weights: np.ndarray, device: str,
              n_trials: int) -> optuna.Study:
    study = optuna.create_study(
        direction      = "minimize",
        sampler        = TPESampler(seed=GLOBAL_SEED, n_startup_trials=10),
        study_name     = f"{model_name}_rmsse_study",
        storage        = f"sqlite:///optuna_{model_name}.db",
        load_if_exists = True,
    )
    print(f"\n[{model_name.upper()}] Starting Optuna search ({n_trials} trials) ...")
    study.optimize(
        make_objective(model_name, series, profit_weights, device),
        n_trials          = n_trials,
        show_progress_bar = True,
        gc_after_trial    = True,
    )
    return study


def save_best(model_name: str, study: optuna.Study):
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    best    = study.best_trial
    params  = best.params.copy()

    # Decode stack_config back to actual values
    if "stack_config" in params:
        idx = params.pop("stack_config")
        pk, fd = NHITS_STACK_CONFIGS[idx]
        params["pool_kernels"]     = list(pk)
        params["freq_downsamples"] = list(fd)

    result = {
        "model"       : model_name,
        "wrmsse"      : best.value,
        "trial_number": best.number,
        "params"      : params,
        "user_attrs"  : best.user_attrs,
    }
    path = os.path.join(CHECKPOINT_DIR, f"{model_name}_best_params.json")
    with open(path, "w") as f:
        json.dump(result, f, indent=4)

    best_metrics = {
        "wrmsse"     : best.value,
        "rmsse_mean" : best.user_attrs.get("rmsse_mean", float("nan")),
        "rmsse_p50"  : float("nan"),
        "rmsse_p90"  : best.user_attrs.get("rmsse_p90",  float("nan")),
    }
    print_score(best_metrics, model_name=model_name)
    print(f"  Trial #     : {best.number}")
    for k, v in params.items():
        print(f"  {k:22s}: {v}")
    print(f"  Saved → {path}")
    return result


def print_comparison(results: list[dict]):
    """In bảng so sánh tất cả models khi chạy --model all."""
    print("\n" + "="*55)
    print("  MODEL COMPARISON (by WRMSSE ↓)")
    print("="*55)
    sorted_r = sorted(results, key=lambda r: r["wrmsse"])
    for rank, r in enumerate(sorted_r, start=1):
        print(f"  #{rank}  {r['model'].upper():10s}  WRMSSE={r['wrmsse']:.6f}")
    print("="*55)
    best = sorted_r[0]
    print(f"  → Best overall: {best['model'].upper()}  "
          f"(WRMSSE={best['wrmsse']:.6f})")
    print("="*55)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",  type=str, default="nbeats",
                        choices=list(MODEL_REGISTRY.keys()) + ["all"])
    parser.add_argument("--trials", type=int, default=50)
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    series, all_skus, submission_df, profit_weights, _ = load_data()

    models_to_run = (list(MODEL_REGISTRY.keys())
                     if args.model == "all" else [args.model])

    all_results = []
    for model_name in models_to_run:
        study  = run_study(model_name, series, profit_weights,
                           device, args.trials)
        result = save_best(model_name, study)
        all_results.append(result)

        # Top-5 trials summary
        try:
            df = study.trials_dataframe()
            print(f"\n  Top-5 trials for {model_name.upper()}:")
            print(df.sort_values("value")[["number", "value"]]
                    .head(5).to_string(index=False))
        except Exception:
            pass

    if len(all_results) > 1:
        print_comparison(all_results)


if __name__ == "__main__":
    main()