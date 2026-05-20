"""
LightGBM custom evaluation: profit-weighted RMSE proxy for WRMSSE-aligned training.
"""

import numpy as np


def wrmsse_feval(preds: np.ndarray, dataset) -> tuple:
    """
    Feval returning weighted RMSE (lower is better).
    Sample weights should already include profit_weight / sqrt(denom).
    """
    y = dataset.get_label()
    w = dataset.get_weight()
    if w is None:
        w = np.ones_like(y)
    err = preds - y
    wmse = np.average(err ** 2, weights=w)
    wrmse = float(np.sqrt(wmse))
    return "wrmse", wrmse, False


def wrmsse_metric_for_lgb():
    """Return feval callable for lgb.train."""
    return wrmsse_feval
