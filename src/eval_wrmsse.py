"""
WRMSSE evaluation utilities (competition metric).
"""

import numpy as np
import pandas as pd

from config import PROC_DIR, TRAIN_END, VALID_START


def load_sku_weights() -> pd.DataFrame:
    df = pd.read_csv(PROC_DIR / "sku_weights.csv")
    return df.set_index("ItemCode")


def compute_wrmsse(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    weights: np.ndarray,
    denominators: np.ndarray,
) -> float:
    """WRMSSE = sum_i w_i * RMSE_i / sqrt(denom_i)."""
    if y_true.ndim == 1:
        y_true = y_true.reshape(-1, 1)
        y_pred = y_pred.reshape(-1, 1)

    score = 0.0
    for i in range(y_true.shape[0]):
        w = float(weights[i])
        if w <= 0:
            continue
        denom = max(float(denominators[i]), 1e-8)
        yt = y_true[i]
        yp = y_pred[i]
        valid = ~np.isnan(yt)
        if valid.sum() == 0:
            continue
        rmse = np.sqrt(np.mean((yt[valid] - yp[valid]) ** 2))
        score += w * (rmse / np.sqrt(denom))
    return score


def wrmsse_from_daily_pivot(
    daily_qty: pd.DataFrame,
    preds: np.ndarray,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    forecast_start: pd.Timestamp,
    horizon: int = 28,
) -> float:
    """Compare preds (n_skus, horizon) to actuals from daily_qty pivot."""
    dates = pd.date_range(forecast_start, periods=horizon, freq="D")
    y_true_list = []
    y_pred_list = []
    weights = []
    denoms = []

    for i, sku in enumerate(sub_skus):
        w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0.0
        denom = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
        weights.append(w)
        denoms.append(denom)

        if sku in daily_qty.columns:
            col = daily_qty[sku]
            y_true_list.append(col.reindex(dates, fill_value=0).values[:horizon])
        else:
            y_true_list.append(np.zeros(horizon))
        y_pred_list.append(preds[i, :horizon])

    return compute_wrmsse(
        np.array(y_true_list),
        np.array(y_pred_list),
        np.array(weights),
        np.array(denoms),
    )


def print_eval_report(
    daily_qty: pd.DataFrame,
    preds_val: np.ndarray,
    preds_eval: np.ndarray,
    sub_skus: list,
    sku_weights: pd.DataFrame,
) -> dict:
    """Evaluate aligned WRMSSE folds."""
    train_end = pd.Timestamp(TRAIN_END)
    valid_start = pd.Timestamp(VALID_START)

    fold_a_start = train_end - pd.Timedelta(days=27)
    wrmsse_a = wrmsse_from_daily_pivot(
        daily_qty, preds_val, sub_skus, sku_weights, fold_a_start, 28
    )

    wrmsse_public = wrmsse_from_daily_pivot(
        daily_qty, preds_val, sub_skus, sku_weights, valid_start, 28
    )

    private_start = valid_start + pd.Timedelta(days=28)
    wrmsse_private = wrmsse_from_daily_pivot(
        daily_qty, preds_eval, sub_skus, sku_weights, private_start, 28
    )

    report = {
        "fold_a_last28_train": wrmsse_a,
        "fold_b_public_window": wrmsse_public,
        "fold_c_private_window_proxy": wrmsse_private,
    }
    print("\n  WRMSSE evaluation (aligned windows):")
    print(f"    Fold A (last 28d train {fold_a_start.date()}..{train_end.date()}): {wrmsse_a:.6f}")
    print(f"    Fold B (public window {valid_start.date()}..):              {wrmsse_public:.6f}")
    print(f"    Fold C (private proxy {private_start.date()}..):            {wrmsse_private:.6f}")
    return report
