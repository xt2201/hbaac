# train.py
"""
Train model với early stopping dựa trên WRMSSE val.

Ví dụ:
    python train.py                              # N-BEATS mặc định
    python train.py --model nhits
    python train.py --model nbeats,nhits         # train nhiều model
    python train.py --model all                  # train tất cả
    python train.py --model nbeats --steps 3000 --patience 3
    python train.py --model lgbm   --lgbm-windows 200
    python train.py --model nbeats --params checkpoints/nbeats_best_params.json
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
from utils.metrics import evaluate_model, print_score
from models.nhits   import build_nhits
from models.nbeats  import build_nbeats
from models.tft     import build_tft
from models.dlinear import build_dlinear
from models.lgbm    import build_lgbm, LGBMForecaster


MODEL_REGISTRY = {
    "nhits"  : build_nhits,
    "nbeats" : build_nbeats,
    "tft"    : build_tft,
    "dlinear": build_dlinear,
    "lgbm"   : build_lgbm,
}


def get_loss_fn(loss_name: str, delta: float = 1.0) -> nn.Module:
    return {
        "mae"   : nn.L1Loss(),
        "mse"   : nn.MSELoss(),
        "huber" : nn.HuberLoss(delta=delta),
    }.get(loss_name, nn.L1Loss())


# ── LightGBM training path ────────────────────────────────────────────────────

def _train_lgbm(model_params: dict, train_params: dict,
                series: np.ndarray, profit_weights: np.ndarray,
                verbose: bool, full_train: bool) -> LGBMForecaster:
    train_series = series if full_train else series[:, :-VAL_STEPS]
    seed         = train_params.get("seed", GLOBAL_SEED)
    max_windows  = model_params.get("max_windows_per_sku", 100)

    _skip = {"loss", "max_windows_per_sku"}
    lgbm_p = {k: v for k, v in model_params.items() if k not in _skip}

    forecaster = LGBMForecaster(lgbm_params=lgbm_p, random_state=seed)
    forecaster.fit(train_series, profit_weights,
                   max_windows_per_sku=max_windows, verbose=verbose)
    return forecaster


# ── PyTorch training loop ────────────────────────────────────────────────────

def train(model_name: str, model_params: dict, train_params: dict,
          series: np.ndarray, profit_weights: np.ndarray,
          device: str, verbose: bool = True,
          full_train: bool = False):
    """
    Core training function — dùng bởi train.py, optuna_search.py, predict.py.

    full_train=False : hold out last VAL_STEPS, early stopping theo WRMSSE val.
    full_train=True  : train toàn bộ series (cho submission), không early stopping.

    Trả về model (PyTorch nn.Module hoặc LGBMForecaster).
    Với PyTorch, model._best_step ghi lại bước early stopping tốt nhất.
    """
    if model_name == "lgbm":
        return _train_lgbm(model_params, train_params, series, profit_weights,
                           verbose, full_train)

    torch.manual_seed(train_params.get("seed", GLOBAL_SEED))
    np.random.seed(train_params.get("seed", GLOBAL_SEED))

    train_series = series if full_train else series[:, :-VAL_STEPS]

    model = MODEL_REGISTRY[model_name](model_params).to(device)

    max_steps  = train_params.get("max_steps",  DEFAULT_MAX_STEPS)
    batch_size = train_params.get("batch_size",  DEFAULT_BATCH_SIZE)
    lr         = train_params.get("lr",          DEFAULT_LR)
    wd         = train_params.get("weight_decay", 0.0)
    eval_every = train_params.get("eval_every",  200)
    patience   = train_params.get("patience",    5)
    loss_fn    = get_loss_fn(model_params.get("loss", "mae"),
                             model_params.get("huber_delta", 1.0))

    opt       = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=wd)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max_steps)

    dataset = WindowDataset(train_series, INPUT_SIZE, HORIZON,
                            n_samples=batch_size * max_steps,
                            sample_weights=profit_weights)
    loader  = DataLoader(dataset, batch_size=batch_size,
                         shuffle=False, num_workers=0, pin_memory=False)

    best_wrmsse = float("inf")
    best_state  = None
    best_step   = max_steps
    no_improve  = 0

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
            print(f"  Step {step:>5}/{max_steps} | loss: {running_loss/100:.4f} "
                  f"| {elapsed:.0f}s elapsed")
            running_loss = 0.0

        # Early stopping — chỉ khi không phải full_train
        if not full_train and step % eval_every == 0:
            val_w = evaluate_model(model, series, profit_weights, device)["wrmsse"]
            model.train()

            if val_w < best_wrmsse - 1e-6:
                best_wrmsse = val_w
                best_state  = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                best_step   = step
                no_improve  = 0
                tag = "↓ best"
            else:
                no_improve += 1
                tag = f"no improve {no_improve}/{patience}"

            if verbose:
                print(f"  [Val] Step {step:>5} | WRMSSE: {val_w:.4f} {tag}")

            if no_improve >= patience:
                if verbose:
                    print(f"  Early stop tại step {step} — "
                          f"best WRMSSE: {best_wrmsse:.4f} @ step {best_step}")
                break

        if step >= max_steps:
            break

    if best_state is not None:
        model.load_state_dict({k: v.to(device) for k, v in best_state.items()})

    model._best_step   = best_step    # dùng bởi predict.py để full_train dùng đúng số steps
    model._best_wrmsse = best_wrmsse
    return model


# ── Checkpoint ────────────────────────────────────────────────────────────────

def save_checkpoint(model, model_name: str, model_params: dict,
                    train_params: dict, metrics: dict):
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    path = os.path.join(CHECKPOINT_DIR, f"{model_name}_checkpoint.pt")
    torch.save({
        "model_state" : model.state_dict(),
        "model_params": model_params,
        "train_params": train_params,
        "metrics"     : metrics,
    }, path)
    print(f"  Saved → {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train forecasting model(s)")
    parser.add_argument("--model",       type=str,   default="nbeats",
                        help="'all', comma-separated (nbeats,nhits), hoặc tên đơn")
    parser.add_argument("--steps",       type=int,   default=DEFAULT_MAX_STEPS,
                        help="Số bước tối đa (PyTorch models)")
    parser.add_argument("--batch",       type=int,   default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--lr",          type=float, default=DEFAULT_LR)
    parser.add_argument("--loss",        type=str,   default="mae",
                        choices=["mae", "mse", "huber"])
    parser.add_argument("--patience",    type=int,   default=5,
                        help="Early stopping patience (số eval liên tiếp không cải thiện)")
    parser.add_argument("--eval-every",  type=int,   default=200,
                        help="Evaluate WRMSSE mỗi N steps")
    parser.add_argument("--lgbm-windows",type=int,   default=100,
                        help="Max windows/SKU cho LightGBM")
    parser.add_argument("--params",      type=str,   default=None,
                        help="Path to JSON params file (từ Optuna)")
    parser.add_argument("--no-save",     action="store_true")
    args = parser.parse_args()

    # Parse danh sách models
    if args.model == "all":
        models_to_train = list(MODEL_REGISTRY.keys())
    elif "," in args.model:
        models_to_train = [m.strip() for m in args.model.split(",")]
    else:
        models_to_train = [args.model]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n{'='*55}")
    print(f"  Models : {', '.join(m.upper() for m in models_to_train)}")
    print(f"  Device : {device}")
    print(f"{'='*55}")

    series, all_skus, _, profit_weights, _ = load_data()

    summary = []   # thu thập kết quả để in bảng so sánh cuối

    for model_name in models_to_train:
        print(f"\n{'─'*55}")
        print(f"  Training {model_name.upper()} ...")
        print(f"{'─'*55}")

        # Build model params
        model_params = dict(MODEL_DEFAULTS[model_name])

        if model_name != "lgbm":
            model_params["loss"] = args.loss  # lgbm không dùng loss này

        if model_name == "lgbm":
            model_params["max_windows_per_sku"] = args.lgbm_windows

        if args.params:
            with open(args.params) as f:
                saved = json.load(f)
            model_params.update(saved.get("params", saved))
            print(f"  Loaded params from {args.params}")

        # Build train params (chỉ dùng bởi PyTorch models)
        train_params = {
            "max_steps"   : args.steps,
            "batch_size"  : args.batch,
            "lr"          : args.lr,
            "weight_decay": 0.0,
            "seed"        : GLOBAL_SEED,
            "patience"    : args.patience,
            "eval_every"  : args.eval_every,
        }

        if model_name != "lgbm":
            print(f"  Model params : {model_params}")
            print(f"  Train params : max_steps={args.steps}, lr={args.lr}, "
                  f"patience={args.patience}, eval_every={args.eval_every}")
        else:
            print(f"  LGBM params  : n_estimators={model_params.get('n_estimators')}, "
                  f"windows/sku={args.lgbm_windows}")

        model   = train(model_name, model_params, train_params,
                        series, profit_weights, device)
        metrics = evaluate_model(model, series, profit_weights, device)
        print_score(metrics, model_name=f"{model_name.upper()} [VAL]")

        summary.append({
            "model"  : model_name,
            "wrmsse" : metrics["wrmsse"],
            "p90"    : metrics["rmsse_p90"],
            "best_step": getattr(model, "_best_step", args.steps),
        })

        if not args.no_save:
            save_checkpoint(model, model_name, model_params, train_params, metrics)

    # Bảng so sánh khi train nhiều model
    if len(summary) > 1:
        print(f"\n{'='*55}")
        print(f"  KẾT QUẢ SO SÁNH")
        print(f"{'='*55}")
        print(f"  {'Model':<10} {'WRMSSE':>10} {'RMSSE p90':>10} {'Best step':>10}")
        print(f"  {'-'*42}")
        for r in sorted(summary, key=lambda x: x["wrmsse"]):
            print(f"  {r['model']:<10} {r['wrmsse']:>10.4f} {r['p90']:>10.4f} "
                  f"{r['best_step']:>10}")
        best = min(summary, key=lambda x: x["wrmsse"])
        print(f"{'='*55}")
        print(f"  → Best: {best['model'].upper()}  (WRMSSE={best['wrmsse']:.4f})")
        print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
