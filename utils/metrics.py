# utils/metrics.py
"""
RMSSE và WRMSSE — metric chính thức của competition.

RMSSE_i = sqrt( mean((Y_t - Ŷ_t)²) / mean((Y_t - Y_{t-1})²) )
WRMSSE  = Σ_i  w_i × RMSSE_i   where w_i = profit_i / Σ profit_j
"""

import numpy as np
import torch
from configs.config import INPUT_SIZE, VAL_STEPS


def rmsse_per_series(actual: np.ndarray,
                     forecast: np.ndarray,
                     train: np.ndarray) -> np.ndarray:
    """
    Parameters
    ----------
    actual   : (N, h)  ground-truth future values
    forecast : (N, h)  model predictions (already clipped ≥ 0)
    train    : (N, T)  historical training values (for naive denominator)

    Returns
    -------
    rmsse : (N,)  per-series RMSSE
    """
    mse_fc    = ((actual - forecast) ** 2).mean(axis=1)          # (N,)
    diff      = np.diff(train, axis=1)                           # (N, T-1)
    naive_mse = (diff ** 2).mean(axis=1)                         # (N,)
    naive_mse = np.where(naive_mse == 0, 1e-8, naive_mse)        # avoid /0
    return np.sqrt(mse_fc / naive_mse)                           # (N,)


def wrmsse(actual: np.ndarray,
           forecast: np.ndarray,
           train: np.ndarray,
           profit_weights: np.ndarray) -> float:
    """
    Profit-weighted RMSSE.
    profit_weights should already be normalized (sum = 1, negatives → 0).
    """
    rmsse_arr = rmsse_per_series(actual, forecast, train)
    w = np.where(profit_weights < 0, 0.0, profit_weights)
    total_w = w.sum()
    if total_w == 0:
        return float(rmsse_arr.mean())
    return float((rmsse_arr * w / total_w).sum())


def evaluate_model(model, series: np.ndarray,
                   profit_weights: np.ndarray,
                   device: str,
                   input_size: int = INPUT_SIZE,
                   val_steps: int  = VAL_STEPS) -> dict:
    """
    Evaluate model trên hold-out val_steps cuối của series.
    Trả về dict với cả RMSSE trung bình và WRMSSE.
    """
    model.eval()
    train_part = series[:, :-val_steps]
    actual     = series[:, -val_steps:]

    with torch.no_grad():
        inp    = torch.from_numpy(train_part[:, -input_size:]).to(device)
        chunks = []
        for i in range(0, inp.size(0), 512):
            chunks.append(model(inp[i:i+512]).cpu().numpy())
        fc = np.clip(np.concatenate(chunks, axis=0), 0, None)[:, :val_steps]

    rmsse_arr  = rmsse_per_series(actual, fc, train_part)
    mean_rmsse = float(rmsse_arr.mean())
    w_rmsse    = wrmsse(actual, fc, train_part, profit_weights)

    return {
        "wrmsse"     : w_rmsse,
        "rmsse_mean" : mean_rmsse,
        "rmsse_p50"  : float(np.median(rmsse_arr)),
        "rmsse_p90"  : float(np.percentile(rmsse_arr, 90)),
    }