"""
Intermittent demand: Croston + two-stage zero-inflated for tail SKUs.
"""

from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import MODEL_DIR, TAIL_TXN_MAX, TRAIN_END, VAL_DAYS
from v5_features import enrich_panel
from v6_features import FEAT_COLS_V6

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)


def croston_forecast(series: np.ndarray, horizon: int, alpha: float = 0.1) -> np.ndarray:
    """Simple Croston on daily series (non-negative)."""
    y = np.asarray(series, dtype=np.float64)
    preds = np.zeros(horizon, dtype=np.float32)
    if len(y) == 0 or y.sum() == 0:
        return preds

    level = 0.0
    interval = 1.0
    last_i = -1
    for i, val in enumerate(y):
        if val > 0:
            if last_i < 0:
                level = val
                interval = 1.0
            else:
                interval = alpha * (i - last_i) + (1 - alpha) * interval
                level = alpha * val + (1 - alpha) * level
            last_i = i

    if last_i < 0:
        return preds
    rate = level / max(interval, 1.0)
    preds[:] = max(rate, 0.0)
    return preds


def build_croston_matrix(
    daily_qty: pd.DataFrame,
    sub_skus: list,
    horizon: int = 56,
) -> np.ndarray:
    """Shape (n_skus, horizon)."""
    out = np.zeros((len(sub_skus), horizon), dtype=np.float32)
    for i, sku in enumerate(sub_skus):
        if sku in daily_qty.columns:
            out[i, :] = croston_forecast(daily_qty[sku].values, horizon)
    return out


def train_two_stage_models(
    fp: pd.DataFrame,
    sub_skus: list,
    tail_skus: list,
    save_prefix: str = "zi_tail",
) -> tuple[lgb.Booster, lgb.Booster]:
    """Binary P(qty>0) + Tweedie E[qty|qty>0] on tail SKUs only."""
    fp = enrich_panel(fp.copy(), sub_skus)
    sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)
    df = fp[fp["ItemCode"].isin(tail_skus)].copy()
    df["ItemCode_cat"] = df["ItemCode"].astype(sku_cat).cat.codes
    df["has_sale"] = (df["qty"] > 0).astype(int)

    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in df.columns))
    mask_train = df["Date"] < VAL_START_TS
    mask_val = df["Date"] >= VAL_START_TS

    clf_params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "learning_rate": 0.05,
        "num_leaves": 63,
        "max_depth": 6,
        "min_data_in_leaf": 50,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }
    dtrain_clf = lgb.Dataset(
        df.loc[mask_train, feat_cols],
        label=df.loc[mask_train, "has_sale"],
        free_raw_data=True,
    )
    dval_clf = lgb.Dataset(
        df.loc[mask_val, feat_cols],
        label=df.loc[mask_val, "has_sale"],
        reference=dtrain_clf,
        free_raw_data=True,
    )
    clf = lgb.train(
        clf_params,
        dtrain_clf,
        num_boost_round=500,
        valid_sets=[dval_clf],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )

    pos = df[df["qty"] > 0]
    mask_train_p = pos["Date"] < VAL_START_TS
    mask_val_p = pos["Date"] >= VAL_START_TS
    reg_params = {
        "objective": "tweedie",
        "tweedie_variance_power": 1.3,
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "max_depth": 5,
        "min_data_in_leaf": 20,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }
    dtrain_reg = lgb.Dataset(
        pos.loc[mask_train_p, feat_cols],
        label=pos.loc[mask_train_p, "qty"],
        free_raw_data=True,
    )
    dval_reg = lgb.Dataset(
        pos.loc[mask_val_p, feat_cols],
        label=pos.loc[mask_val_p, "qty"],
        reference=dtrain_reg,
        free_raw_data=True,
    )
    reg = lgb.train(
        reg_params,
        dtrain_reg,
        num_boost_round=500,
        valid_sets=[dval_reg],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )

    MODEL_DIR.mkdir(exist_ok=True)
    clf.save_model(str(MODEL_DIR / f"{save_prefix}_clf.txt"))
    reg.save_model(str(MODEL_DIR / f"{save_prefix}_reg.txt"))
    return clf, reg


def load_two_stage_models(prefix: str = "zi_tail") -> tuple[lgb.Booster | None, lgb.Booster | None]:
    clf_path = MODEL_DIR / f"{prefix}_clf.txt"
    reg_path = MODEL_DIR / f"{prefix}_reg.txt"
    if not clf_path.exists() or not reg_path.exists():
        return None, None
    return (
        lgb.Booster(model_file=str(clf_path)),
        lgb.Booster(model_file=str(reg_path)),
    )


def two_stage_predict(
    clf: lgb.Booster,
    reg: lgb.Booster,
    feat_df: pd.DataFrame,
    feat_cols: list[str],
) -> np.ndarray:
    """pred = P(sale) * E[qty|sale]."""
    cols = [c for c in feat_cols if c in feat_df.columns]
    p = clf.predict(feat_df[cols])
    e = reg.predict(feat_df[cols])
    return np.clip(p * e, 0, None).astype(np.float32)
