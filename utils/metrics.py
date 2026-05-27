# utils/metrics.py
"""
RMSSE và WRMSSE — metric chính thức của competition.

RMSSE_i = sqrt( (1/h  * Σ_{t=n+1}^{n+h} (Y_t - Ŷ_t)²)
              / (1/(n-1) * Σ_{t=2}^{n}   (Y_t - Y_{t-1})²) )

WRMSSE = Σ_i  w_i × RMSSE_i
  where  w_i = max(profit_i, 0) / Σ_j max(profit_j, 0)
         profit_i = Σ_train (SalesAmount - CostAmount)
"""

import numpy as np
import torch
from configs.config import INPUT_SIZE, HORIZON, VAL_STEPS


def rmsse_per_series(actual: np.ndarray,
                     forecast: np.ndarray,
                     train: np.ndarray) -> np.ndarray:
    """
    actual   : (N, h)  ground-truth future values
    forecast : (N, h)  model predictions (already clipped ≥ 0)
    train    : (N, T)  full training history (dùng cho naive denominator)

    RMSSE_i = sqrt( mean_h(err²) / mean_{n-1}(naive_diff²) )

    SKU có naive_mse = 0 (series phẳng toàn 0 trong train) không thể tính
    RMSSE có nghĩa → trả về 0 để không contaminate WRMSSE.
    Thực tế các SKU này cũng có profit weight ≈ 0 nên không ảnh hưởng score.
    """
    # Numerator  : 1/h * Σ (Y_t - Ŷ_t)²
    mse_fc    = ((actual - forecast) ** 2).mean(axis=1)      # (N,)
    # Denominator: 1/(n-1) * Σ (Y_t - Y_{t-1})²
    diff      = np.diff(train, axis=1)                        # (N, n-1)
    naive_mse = (diff ** 2).mean(axis=1)                      # (N,)

    # SKU với denominator = 0: series không có biến động trong train
    # → không xác định được RMSSE → gán 0 (không đóng góp vào WRMSSE)
    valid     = naive_mse > 0
    rmsse     = np.zeros(len(mse_fc), dtype=np.float64)
    rmsse[valid] = np.sqrt(mse_fc[valid] / naive_mse[valid])
    return rmsse


def wrmsse(actual: np.ndarray,
           forecast: np.ndarray,
           train: np.ndarray,
           profit_weights: np.ndarray) -> float:
    """
    WRMSSE = Σ_i RMSSE_i × w_i
    profit_weights đã normalized (sum=1, âm→0) từ data_loader.
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
                   eval_steps: int = VAL_STEPS,
                   skip_last: int  = 0) -> dict:
    """
    Evaluate model trên val set (last eval_steps days of series).

    series[:, :-eval_steps]  → train denominator
    series[:, -eval_steps:]  → actual
    """
    model.eval()
    if skip_last > 0:
        train_part = series[:, :-eval_steps - skip_last]
        actual     = series[:, -eval_steps - skip_last : -skip_last]
    else:
        train_part = series[:, :-eval_steps]
        actual     = series[:, -eval_steps:]

    # Model chỉ output HORIZON bước → giới hạn đánh giá tối đa HORIZON ngày
    eval_horizon = min(eval_steps, HORIZON)

    with torch.no_grad():
        inp    = torch.from_numpy(train_part[:, -input_size:]).to(device)
        chunks = []
        for i in range(0, inp.size(0), 512):
            chunks.append(model(inp[i:i+512]).cpu().numpy())
        fc = np.clip(np.concatenate(chunks, axis=0), 0, None)[:, :eval_horizon]

    actual = actual[:, :eval_horizon]
    rmsse_arr = rmsse_per_series(actual, fc, train_part)
    w_rmsse   = wrmsse(actual, fc, train_part, profit_weights)

    return {
        "wrmsse"     : w_rmsse,
        "rmsse_mean" : float(rmsse_arr.mean()),
        "rmsse_p50"  : float(np.median(rmsse_arr)),
        "rmsse_p90"  : float(np.percentile(rmsse_arr, 90)),
        "rmsse_arr"  : rmsse_arr,
    }


def print_score(metrics: dict, model_name: str = "", prefix: str = ""):
    """In bảng điểm WRMSSE theo định dạng chuẩn."""
    w   = metrics["wrmsse"]
    tag = " ✓ Better than naive" if w < 1.0 else " ✗ Worse than naive"
    bar = "=" * 55
    print(f"\n{prefix}{bar}")
    if model_name:
        print(f"{prefix}  Model       : {model_name.upper()}")
    print(f"{prefix}  Metric      : WRMSSE (lower is better){tag}")
    print(f"{prefix}{'-' * 55}")
    print(f"{prefix}  WRMSSE      : {w:.6f}   ← competition score")
    print(f"{prefix}  RMSSE mean  : {metrics['rmsse_mean']:.6f}")
    print(f"{prefix}  RMSSE p50   : {metrics['rmsse_p50']:.6f}")
    print(f"{prefix}  RMSSE p90   : {metrics['rmsse_p90']:.6f}")
    # SKU breakdown
    arr = metrics.get("rmsse_arr")
    if arr is not None:
        n_better = int((arr < 1.0).sum())
        n_total  = len(arr)
        print(f"{prefix}  SKUs < 1.0  : {n_better}/{n_total} ({100*n_better/n_total:.1f}%)")
    print(f"{prefix}{bar}\n")