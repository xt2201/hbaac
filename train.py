# train.py
"""
Train một model cụ thể với hyperparameters mặc định (hoặc từ best_params.json).

Ví dụ:
    python train.py --model nhits
    python train.py --model nbeats --steps 2000 --batch 512
    python train.py --model tft    --steps 1000 --lr 5e-4
    python train.py --model dlinear
    python train.py --model nhits  --params checkpoints/nhits_best_params.json
"""

import argparse
import json
import os
import time

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from configs.config import (
    GLOBAL_SEED, INPUT_SIZE, HORIZON, VAL_STEPS,
    DEFAULT_BATCH_SIZE, DEFAULT_MAX_STEPS, DEFAULT_LR,
    CHECKPOINT_DIR, MODEL_DEFAULTS,
)
from utils.data_loader import load_data
from utils.dataset import WindowDataset
from utils.metrics import evaluate_model
from models.nhits   import build_nhits
from models.nbeats  import build_nbeats
from models.tft     import build_tft
from models.dlinear import build_dlinear


# ── Registry ─────────────────────────────────────────────────────────────────
MODEL_REGISTRY = {
    "nhits"  : build_nhits,
    "nbeats" : build_nbeats,
    "tft"    : build_tft,
    "dlinear": build_dlinear,
}


def get_loss_fn(loss_name: str, delta: float = 1.0) -> nn.Module:
    return {
        "mae"   : nn.L1Loss(),
        "mse"   : nn.MSELoss(),
        "huber" : nn.HuberLoss(delta=delta),
    }.get(loss_name, nn.L1Loss())


def train(model_name: str, model_params: dict, train_params: dict,
          series: np.ndarray, profit_weights: np.ndarray,
          device: str, verbose: bool = True,
          full_train: bool = False) -> nn.Module:
    """
    Core training loop. Dùng bởi cả train.py và optuna_search.py.

    full_train=False (default): hold out last VAL_STEPS for validation.
    full_train=True            : train on entire series (for final submission).
    """
    torch.manual_seed(train_params.get("seed", GLOBAL_SEED))
    np.random.seed(train_params.get("seed", GLOBAL_SEED))

    train_series = series if full_train else series[:, :-VAL_STEPS]

    # Build model
    builder = MODEL_REGISTRY[model_name]
    model   = builder(model_params).to(device)

    max_steps  = train_params.get("max_steps",  DEFAULT_MAX_STEPS)
    batch_size = train_params.get("batch_size",  DEFAULT_BATCH_SIZE)
    lr         = train_params.get("lr",          DEFAULT_LR)
    wd         = train_params.get("weight_decay", 0.0)
    loss_name  = model_params.get("loss", "mae")
    loss_fn    = get_loss_fn(loss_name, model_params.get("huber_delta", 1.0))

    opt       = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=wd)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max_steps)

    dataset = WindowDataset(train_series, INPUT_SIZE, HORIZON,
                            n_samples=batch_size * max_steps,
                            sample_weights=profit_weights)
    loader  = DataLoader(dataset, batch_size=batch_size,
                         shuffle=False, num_workers=0, pin_memory=False)

    model.train()
    running_loss = 0.0
    t0 = time.time()

    for step, (x, y) in enumerate(loader, start=1):
        x, y = x.to(device), y.to(device)
        pred = model(x)
        loss = loss_fn(pred, y)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        scheduler.step()
        running_loss += loss.item()

        if verbose and step % 100 == 0:
            elapsed = time.time() - t0
            avg_loss = running_loss / 100
            print(f"  Step {step:>5}/{max_steps} | loss: {avg_loss:.4f} "
                  f"| {elapsed:.0f}s elapsed")
            running_loss = 0.0

        if step >= max_steps:
            break

    return model


def save_checkpoint(model: nn.Module, model_name: str,
                    model_params: dict, train_params: dict,
                    metrics: dict):
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    path = os.path.join(CHECKPOINT_DIR, f"{model_name}_checkpoint.pt")
    torch.save({
        "model_state" : model.state_dict(),
        "model_params": model_params,
        "train_params": train_params,
        "metrics"     : metrics,
    }, path)
    print(f"  Saved checkpoint → {path}")


def main():
    parser = argparse.ArgumentParser(description="Train a forecasting model")
    parser.add_argument("--model",   type=str,   default="nhits",
                        choices=list(MODEL_REGISTRY.keys()))
    parser.add_argument("--steps",   type=int,   default=DEFAULT_MAX_STEPS)
    parser.add_argument("--batch",   type=int,   default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--lr",      type=float, default=DEFAULT_LR)
    parser.add_argument("--loss",    type=str,   default="mae",
                        choices=["mae", "mse", "huber"])
    parser.add_argument("--params",  type=str,   default=None,
                        help="Path to JSON file with model params (từ Optuna)")
    parser.add_argument("--no-save", action="store_true")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n{'='*55}")
    print(f"  Model  : {args.model.upper()}")
    print(f"  Device : {device}")
    print(f"{'='*55}")

    # Load data
    series, all_skus, submission_df, profit_weights = load_data()

    # Build params
    model_params = dict(MODEL_DEFAULTS[args.model])   # default copy
    model_params["loss"] = args.loss

    if args.params:
        with open(args.params) as f:
            saved = json.load(f)
        loaded = saved.get("params", saved)
        model_params.update(loaded)
        print(f"  Loaded params from {args.params}")

    train_params = {
        "max_steps"   : args.steps,
        "batch_size"  : args.batch,
        "lr"          : args.lr,
        "weight_decay": 0.0,
        "seed"        : GLOBAL_SEED,
    }

    print(f"\nModel params : {model_params}")
    print(f"Train params : {train_params}")

    # Train
    print(f"\nTraining {args.model.upper()} ...")
    model = train(args.model, model_params, train_params,
                  series, profit_weights, device)

    # Evaluate
    print("\nEvaluating on hold-out validation window ...")
    metrics = evaluate_model(model, series, profit_weights, device)
    print(f"  WRMSSE     : {metrics['wrmsse']:.6f}")
    print(f"  RMSSE mean : {metrics['rmsse_mean']:.6f}")
    print(f"  RMSSE p50  : {metrics['rmsse_p50']:.6f}")
    print(f"  RMSSE p90  : {metrics['rmsse_p90']:.6f}")

    # Save
    if not args.no_save:
        save_checkpoint(model, args.model, model_params, train_params, metrics)


if __name__ == "__main__":
    main()