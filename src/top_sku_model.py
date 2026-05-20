"""
Top-200 SKU dedicated model + per-horizon bias matrix.
"""

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    HOLDOUT_START,
    HORIZON,
    MODEL_DIR,
    TOP_BIAS_MATRIX_PATH,
    TOP_TIER_200,
    TRAIN_END,
    VAL_DAYS,
)
from v5_features import enrich_panel
from v6_features import FEAT_COLS_V6
from wrmsse_feval import wrmsse_feval

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)
HOLDOUT_START_TS = pd.Timestamp(HOLDOUT_START)


def get_top_skus(sku_weights: pd.DataFrame, n: int = TOP_TIER_200) -> list:
    return sku_weights.sort_values("weight", ascending=False).head(n).index.tolist()


def train_top200_model(
    fp: pd.DataFrame,
    sub_skus: list,
    top_skus: list,
    save_path: Path,
) -> lgb.Booster:
    fp = enrich_panel(fp.copy(), sub_skus)
    sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)
    fp = fp[fp["ItemCode"].isin(top_skus)]
    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat).cat.codes

    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in fp.columns))
    mask_train = fp["Date"] < VAL_START_TS
    mask_val = fp["Date"] >= VAL_START_TS

    X_train = fp.loc[mask_train, feat_cols]
    y_train = fp.loc[mask_train, "qty"]
    w_train = (
        fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])
    ).values * fp.loc[mask_train, "decay_weight"].values

    X_val = fp.loc[mask_val, feat_cols]
    y_val = fp.loc[mask_val, "qty"]
    w_val = (fp.loc[mask_val, "weight"] / np.sqrt(fp.loc[mask_val, "wrmsse_denom"])).values

    dtrain = lgb.Dataset(X_train, label=y_train, weight=w_train, free_raw_data=True)
    dval = lgb.Dataset(X_val, label=y_val, weight=w_val, reference=dtrain)

    params = {
        "objective": "tweedie",
        "tweedie_variance_power": 1.15,
        "metric": "rmse",
        "learning_rate": 0.04,
        "num_leaves": 511,
        "max_depth": 12,
        "min_data_in_leaf": 20,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.85,
        "bagging_freq": 1,
        "lambda_l1": 0.05,
        "lambda_l2": 0.1,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }

    model = lgb.train(
        params,
        dtrain,
        num_boost_round=2500,
        valid_sets=[dval],
        feval=wrmsse_feval,
        callbacks=[lgb.early_stopping(150, verbose=False)],
    )
    model.save_model(str(save_path))
    return model


def fit_horizon_bias_matrix(
    model: lgb.Booster,
    fp: pd.DataFrame,
    sub_skus: list,
    top_skus: list,
) -> np.ndarray:
    """
    (n_top, 56) bias from holdout residuals using direct horizon-style targets.
    Simplified: scalar bias per sku replicated, plus h>28 extra from Oct mean residual.
    """
    fp = enrich_panel(fp.copy(), sub_skus)
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    top_idx = [sku_to_i[s] for s in top_skus if s in sku_to_i]

    feat_cols = [c for c in model.feature_name() if c in fp.columns]
    holdout = fp[(fp["Date"] >= HOLDOUT_START_TS) & (fp["Date"] <= TRAIN_END_TS)]
    holdout = holdout[holdout["ItemCode"].isin(top_skus)]

    bias = np.zeros((len(sub_skus), HORIZON), dtype=np.float32)
    if holdout.empty:
        np.save(TOP_BIAS_MATRIX_PATH, bias)
        return bias

    pred = model.predict(holdout[feat_cols])
    holdout = holdout.copy()
    holdout["pred"] = pred
    for sku in top_skus:
        sub = holdout[holdout["ItemCode"] == sku]
        if len(sub) == 0:
            continue
        i = sku_to_i[sku]
        b = float((sub["qty"] - sub["pred"]).mean())
        b = np.clip(b, -30, 30)
        bias[i, :] = b
        # extra bump for private horizon proxy (last 14 days holdout)
        last14 = sub.tail(14)
        if len(last14) > 0:
            b2 = float((last14["qty"] - last14["pred"]).mean())
            bias[i, 28:] += np.clip(b2 * 0.5, -15, 15)

    TOP_BIAS_MATRIX_PATH.parent.mkdir(exist_ok=True)
    np.save(TOP_BIAS_MATRIX_PATH, bias)
    return bias


def apply_top_bias(preds: np.ndarray, bias: np.ndarray, sub_skus: list, top_skus: list) -> np.ndarray:
    """preds (n_skus, horizon)."""
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    out = preds.copy()
    for sku in top_skus:
        if sku not in sku_to_i:
            continue
        i = sku_to_i[sku]
        out[i, :] = np.clip(out[i, :] + bias[i, :], 0, None)
    return out
