"""
Ensemble: multi-seed LGBM + CatBoost + OOF WRMSSE stacking by tier.
"""

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    CATBOOST_SEEDS,
    ENSEMBLE_BLEND_PATH,
    LGBM_SEEDS,
    MODEL_DIR,
    PROC_DIR,
    TAIL_TXN_MAX,
    TOP_TIER_N,
    TRAIN_END,
    VAL_DAYS,
    HOLDOUT_START,
)
from eval_wrmsse import compute_wrmsse
from v5_features import enrich_panel
from v6_features import FEAT_COLS_V6
from wrmsse_feval import wrmsse_feval

try:
    from catboost import CatBoostRegressor

    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)
HOLDOUT_START_TS = pd.Timestamp(HOLDOUT_START)


def _lgbm_params(seed: int) -> dict:
    return {
        "objective": "tweedie",
        "tweedie_variance_power": 1.25,
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 255,
        "max_depth": 10,
        "min_data_in_leaf": 100,
        "feature_fraction": 0.7,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "lambda_l1": 0.1,
        "lambda_l2": 0.1,
        "verbose": -1,
        "n_jobs": -1,
        "seed": seed,
    }


def train_lgbm_v6(
    fp: pd.DataFrame,
    sub_skus: list,
    seed: int,
    save_path: Path,
) -> lgb.Booster:
    fp = enrich_panel(fp.copy(), sub_skus)
    sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)
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

    dtrain = lgb.Dataset(
        X_train,
        label=y_train,
        weight=w_train,
        categorical_feature=["ItemCode_cat"],
        free_raw_data=True,
    )
    dval = lgb.Dataset(X_val, label=y_val, weight=w_val, reference=dtrain, free_raw_data=True)

    model = lgb.train(
        _lgbm_params(seed),
        dtrain,
        num_boost_round=2000,
        valid_sets=[dval],
        feval=wrmsse_feval,
        callbacks=[lgb.early_stopping(120, verbose=False), lgb.log_evaluation(300)],
    )
    model.save_model(str(save_path))
    return model


def train_catboost_v6(
    fp: pd.DataFrame,
    sub_skus: list,
    seed: int,
    save_path: Path,
) -> "CatBoostRegressor":
    if not HAS_CATBOOST:
        raise ImportError("catboost not installed")

    fp = enrich_panel(fp.copy(), sub_skus)
    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in fp.columns and c != "ItemCode_cat"))
    mask_train = fp["Date"] < VAL_START_TS
    mask_val = fp["Date"] >= VAL_START_TS

    X_train = fp.loc[mask_train, feat_cols]
    y_train = fp.loc[mask_train, "qty"]
    w_train = (
        fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])
    ).values

    model = CatBoostRegressor(
        loss_function="Tweedie:variance_power=1.25",
        iterations=1500,
        learning_rate=0.05,
        depth=8,
        random_seed=seed,
        verbose=0,
        early_stopping_rounds=100,
    )
    model.fit(
        X_train,
        y_train,
        sample_weight=w_train,
        eval_set=(fp.loc[mask_val, feat_cols], fp.loc[mask_val, "qty"]),
        verbose=False,
    )
    model.save_model(str(save_path))
    return model


def load_all_models(sub_skus: list) -> list[tuple[str, object]]:
    models = []
    for seed in LGBM_SEEDS:
        p = MODEL_DIR / f"lgbm_v6_s{seed}.txt"
        if p.exists():
            models.append((f"lgbm_{seed}", lgb.Booster(model_file=str(p))))
    if HAS_CATBOOST:
        for seed in CATBOOST_SEEDS:
            p = MODEL_DIR / f"catboost_v6_s{seed}.cbm"
            if p.exists():
                m = CatBoostRegressor()
                m.load_model(str(p))
                models.append((f"cat_{seed}", m))
    return models


def train_all_models(fp: pd.DataFrame, sub_skus: list, skip_existing: bool = True) -> None:
    MODEL_DIR.mkdir(exist_ok=True)
    for seed in LGBM_SEEDS:
        path = MODEL_DIR / f"lgbm_v6_s{seed}.txt"
        if skip_existing and path.exists():
            print(f"  Skip existing {path.name}")
            continue
        print(f"  Training LGBM seed={seed} …")
        train_lgbm_v6(fp, sub_skus, seed, path)
    if HAS_CATBOOST:
        for seed in CATBOOST_SEEDS:
            path = MODEL_DIR / f"catboost_v6_s{seed}.cbm"
            if skip_existing and path.exists():
                print(f"  Skip existing {path.name}")
                continue
            print(f"  Training CatBoost seed={seed} …")
            train_catboost_v6(fp, sub_skus, seed, path)
    else:
        print("  CatBoost not installed — LGBM-only ensemble")


def predict_holdout_oof(
    fp: pd.DataFrame,
    sub_skus: list,
    models: list[tuple[str, object]],
) -> dict[str, np.ndarray]:
    """OOF predictions on holdout dates per model: dict name -> (n_days, n_skus)."""
    fp = enrich_panel(fp.copy(), sub_skus)
    sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)
    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat).cat.codes
    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in fp.columns))

    holdout = fp[(fp["Date"] >= HOLDOUT_START_TS) & (fp["Date"] <= TRAIN_END_TS)]
    dates = sorted(holdout["Date"].unique())
    n_skus = len(sub_skus)
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}

    oof = {name: np.zeros((len(dates), n_skus), dtype=np.float32) for name, _ in models}

    for di, d in enumerate(dates):
        day_df = holdout[holdout["Date"] == d]
        X = day_df[feat_cols]
        for name, model in models:
            p = model.predict(X)
            for j, (_, row) in enumerate(day_df.iterrows()):
                i = sku_to_i[row["ItemCode"]]
                oof[name][di, i] = max(float(p[j]), 0.0)
    return oof, dates


def fit_stack_weights(
    oof: dict[str, np.ndarray],
    actuals: np.ndarray,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    txn_counts: dict,
) -> dict:
    """
    Grid search non-negative weights summing to 1 per tier.
    actuals: (n_days, n_skus)
    """
    top_set = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)
    model_names = list(oof.keys())
    n_models = len(model_names)

    tiers = {
        "top": [i for i, s in enumerate(sub_skus) if s in top_set],
        "mid": [
            i
            for i, s in enumerate(sub_skus)
            if s not in top_set and txn_counts.get(s, 0) > TAIL_TXN_MAX
        ],
        "tail": [i for i, s in enumerate(sub_skus) if txn_counts.get(s, 0) <= TAIL_TXN_MAX],
    }

    weights_arr = np.array(
        [float(sku_weights.loc[s, "weight"]) if s in sku_weights.index else 0.0 for s in sub_skus]
    )
    denoms = np.array(
        [
            float(sku_weights.loc[s, "wrmsse_denom"]) if s in sku_weights.index else 1e-8
            for s in sub_skus
        ]
    )

    def score_for_w(wvec, sku_idx):
        pred = sum(wvec[k] * oof[model_names[k]] for k in range(n_models))
        yt = actuals[:, sku_idx]
        yp = pred[:, sku_idx]
        rmse = np.sqrt(np.mean((yt - yp) ** 2))
        return rmse / np.sqrt(max(denoms[sku_idx], 1e-8))

    tier_weights = {}
    for tier_name, sku_idx in tiers.items():
        if not sku_idx:
            tier_weights[tier_name] = [1.0 / n_models] * n_models
            continue
        best_w = [1.0 / n_models] * n_models
        best_score = 1e9
        # grid on 2-3 models dominant
        grid = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
        if n_models == 1:
            best_w = [1.0]
        elif n_models == 2:
            for w0 in grid:
                w = [w0, 1.0 - w0]
                if min(w) < 0:
                    continue
                s = sum(weights_arr[i] * score_for_w(w, i) for i in sku_idx)
                if s < best_score:
                    best_score = s
                    best_w = w
        else:
            # uniform + single-model dominance
            candidates = [[1.0 / n_models] * n_models]
            for k in range(n_models):
                w = [0.05] * n_models
                w[k] = 0.85
                w = [x / sum(w) for x in w]
                candidates.append(w)
            for w in candidates:
                s = sum(weights_arr[i] * score_for_w(w, i) for i in sku_idx)
                if s < best_score:
                    best_score = s
                    best_w = w
        tier_weights[tier_name] = best_w

    result = {"model_names": model_names, "tier_weights": tier_weights}
    with open(ENSEMBLE_BLEND_PATH, "w") as f:
        json.dump(result, f, indent=2)
    return result


def stack_predict_day(
    feat: pd.DataFrame,
    sub_skus: list,
    models: list[tuple[str, object]],
    blend_cfg: dict,
    tier_top: np.ndarray,
    tier_tail: np.ndarray,
) -> np.ndarray:
    """Single day vector (n_skus,)."""
    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in feat.columns))
    n = len(sub_skus)
    preds_m = []
    for name, model in models:
        if name.startswith("lgbm"):
            preds_m.append(model.predict(feat[feat_cols]))
        else:
            preds_m.append(model.predict(feat[feat_cols]))
    preds_m = np.array(preds_m)  # (n_models, n_skus)

    names = blend_cfg["model_names"]
    tw = blend_cfg["tier_weights"]
    out = np.zeros(n, dtype=np.float32)
    tier_mid = ~(tier_top | tier_tail)

    for tier_mask, tier_key in [
        (tier_top, "top"),
        (tier_mid, "mid"),
        (tier_tail, "tail"),
    ]:
        w = np.array(tw[tier_key], dtype=np.float32)
        if len(w) != preds_m.shape[0]:
            w = np.ones(preds_m.shape[0]) / preds_m.shape[0]
        combined = np.tensordot(w, preds_m, axes=(0, 0))
        out[tier_mask] = combined[tier_mask]
    return np.clip(out, 0, None)
