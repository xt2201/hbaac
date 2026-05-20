"""
Direct multi-horizon LightGBM: predict qty[t+h] from features at t.
"""

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    DIRECT_BLEND_PATH,
    DIRECT_MAX_TRAIN_ROWS,
    HORIZON,
    MODEL_DIR,
    PROC_DIR,
    TRAIN_END,
    VAL_DAYS,
)
from eval_wrmsse import eval_horizon_buckets, print_horizon_report
from v5_features import enrich_panel
from v6_features import FEAT_COLS_DIRECT
from wrmsse_feval import wrmsse_feval

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)


def build_horizon_training_frame(
    fp: pd.DataFrame,
    horizons: list[int] | None = None,
    max_rows: int = DIRECT_MAX_TRAIN_ROWS,
) -> pd.DataFrame:
    """Expand panel to (date, sku, horizon) rows with forward target."""
    if horizons is None:
        # Full 56 horizons; subsample caps rows via max_rows below
        horizons = list(range(1, HORIZON + 1))

    parts = []
    for h in horizons:
        chunk = fp.copy()
        chunk["horizon"] = h
        chunk["horizon_sin"] = np.sin(2 * np.pi * h / HORIZON).astype(np.float32)
        chunk["horizon_cos"] = np.cos(2 * np.pi * h / HORIZON).astype(np.float32)
        chunk["is_private_horizon"] = (1 if h > 28 else 0)
        chunk["target_fwd"] = chunk.groupby("ItemCode")["qty"].shift(-h)
        chunk = chunk[chunk["target_fwd"].notna()]
        parts.append(chunk)

    df = pd.concat(parts, ignore_index=True)
    if len(df) > max_rows:
        # Weighted sample toward recent dates and high-weight SKUs
        prob = df["weight"].values + 1e-8
        prob = prob / prob.sum()
        idx = np.random.default_rng(42).choice(len(df), size=max_rows, replace=False, p=prob)
        df = df.iloc[idx]
    return df


def train_direct_model(
    fp: pd.DataFrame,
    sub_skus: list,
    sku_cat_dtype: pd.CategoricalDtype,
    save_path: Path | None = None,
) -> lgb.Booster:
    fp = enrich_panel(fp.copy(), sub_skus)
    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat_dtype).cat.codes

    df = build_horizon_training_frame(fp)
    mask_train = df["Date"] < VAL_START_TS
    mask_val = df["Date"] >= VAL_START_TS

    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_DIRECT if c in df.columns))
    X_train = df.loc[mask_train, feat_cols]
    y_train = df.loc[mask_train, "target_fwd"]
    w_train = (
        df.loc[mask_train, "weight"] / np.sqrt(df.loc[mask_train, "wrmsse_denom"])
    ).values

    X_val = df.loc[mask_val, feat_cols]
    y_val = df.loc[mask_val, "target_fwd"]
    w_val = (df.loc[mask_val, "weight"] / np.sqrt(df.loc[mask_val, "wrmsse_denom"])).values

    dtrain = lgb.Dataset(
        X_train,
        label=y_train,
        weight=w_train,
        categorical_feature=["ItemCode_cat"],
        free_raw_data=True,
    )
    dval = lgb.Dataset(X_val, label=y_val, weight=w_val, reference=dtrain, free_raw_data=True)

    params = {
        "objective": "tweedie",
        "tweedie_variance_power": 1.2,
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 127,
        "max_depth": 9,
        "min_data_in_leaf": 200,
        "feature_fraction": 0.6,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "lambda_l1": 0.2,
        "lambda_l2": 0.2,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }

    model = lgb.train(
        params,
        dtrain,
        num_boost_round=2000,
        valid_sets=[dval],
        feval=wrmsse_feval,
        callbacks=[lgb.early_stopping(100, verbose=False), lgb.log_evaluation(200)],
    )

    if save_path:
        model.save_model(str(save_path))
    return model


def predict_direct_56(
    model: lgb.Booster,
    fp_anchor: pd.DataFrame,
    sub_skus: list,
    sku_cat_dtype: pd.CategoricalDtype,
) -> np.ndarray:
    """Predict (n_skus, 56) from features at TRAIN_END per horizon."""
    anchor = fp_anchor[fp_anchor["Date"] == TRAIN_END_TS].copy()
    if anchor.empty:
        anchor = fp_anchor.groupby("ItemCode").tail(1)

    n = len(sub_skus)
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    preds = np.zeros((n, HORIZON), dtype=np.float32)

    feat_cols = model.feature_name()
    base = anchor.set_index("ItemCode")

    for h in range(1, HORIZON + 1):
        rows = []
        order = []
        for sku in sub_skus:
            if sku not in base.index:
                continue
            row = base.loc[sku].copy()
            if isinstance(row, pd.DataFrame):
                row = row.iloc[-1]
            row["horizon"] = h
            row["horizon_sin"] = np.sin(2 * np.pi * h / HORIZON)
            row["horizon_cos"] = np.cos(2 * np.pi * h / HORIZON)
            row["is_private_horizon"] = 1 if h > 28 else 0
            row["ItemCode_cat"] = pd.Categorical([sku], categories=sub_skus).codes[0]
            rows.append(row)
            order.append(sku)
        if not rows:
            continue
        X = pd.DataFrame(rows)
        missing = [c for c in feat_cols if c not in X.columns]
        for c in missing:
            X[c] = 0
        p = model.predict(X[feat_cols])
        for sku, val in zip(order, p):
            preds[sku_to_i[sku], h - 1] = max(float(val), 0.0)
    return preds


def tune_direct_blend_alphas(
    direct: np.ndarray,
    recursive: np.ndarray,
    daily_qty: pd.DataFrame,
    sub_skus: list,
    sku_weights: pd.DataFrame,
) -> np.ndarray:
    """Per-horizon blend weight for direct model (h index 0..55)."""
    alphas = np.zeros(HORIZON, dtype=np.float32)
    anchor = TRAIN_END_TS
    best_global = 1e9
    for h in range(HORIZON):
        best_a = 0.5
        best_s = 1e9
        for a in np.arange(0.0, 1.05, 0.1):
            blended = a * direct[:, h : h + 1] + (1 - a) * recursive[:, h : h + 1]
            rep = np.tile(blended, (1, 28))
            r = eval_horizon_buckets(daily_qty, rep, sub_skus, sku_weights, anchor, [h + 1])
            if r["all"] < best_s:
                best_s = r["all"]
                best_a = a
        alphas[h] = best_a
    # Coarse global pass: favor direct for h>21
    for h in range(21, HORIZON):
        alphas[h] = max(alphas[h], 0.7)
    for h in range(14):
        alphas[h] = min(alphas[h], 0.6)
    DIRECT_BLEND_PATH.parent.mkdir(exist_ok=True)
    with open(DIRECT_BLEND_PATH, "w") as f:
        json.dump({"alphas": alphas.tolist()}, f)
    return alphas


def blend_direct_recursive(
    direct: np.ndarray,
    recursive: np.ndarray,
    alphas: np.ndarray | None = None,
) -> np.ndarray:
    if alphas is None:
        if DIRECT_BLEND_PATH.exists():
            with open(DIRECT_BLEND_PATH) as f:
                alphas = np.array(json.load(f)["alphas"], dtype=np.float32)
        else:
            alphas = np.linspace(0.3, 0.85, HORIZON).astype(np.float32)
    out = np.zeros_like(direct)
    for h in range(HORIZON):
        out[:, h] = alphas[h] * direct[:, h] + (1 - alphas[h]) * recursive[:, h]
    return np.clip(out, 0, None)
