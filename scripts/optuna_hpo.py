"""
Optuna HPO for LGBM V6 (profit-weighted holdout WRMSSE proxy).
"""

import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import FEATURE_PANEL_V6, HOLDOUT_START, OPTUNA_TRIALS, PROC_DIR, TRAIN_END, VAL_DAYS
from eval_wrmsse import compute_wrmsse
from eval_wrmsse import load_sku_weights
from v5_features import enrich_panel
from v6_features import FEAT_COLS_V6
from wrmsse_feval import wrmsse_feval

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
HOLDOUT_START_TS = pd.Timestamp(HOLDOUT_START)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)


def main():
    fp = pd.read_parquet(FEATURE_PANEL_V6)
    fp["Date"] = pd.to_datetime(fp["Date"])
    sample = pd.read_csv(ROOT / "dataset" / "sample_submission.csv")
    sub_skus = sorted(
        sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
    )
    fp = enrich_panel(fp, sub_skus)
    sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)
    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat).cat.codes
    sku_weights = load_sku_weights()

    feat_cols = [c for c in FEAT_COLS_V6 if c in fp.columns]
    holdout = fp[(fp["Date"] >= HOLDOUT_START_TS) & (fp["Date"] <= TRAIN_END_TS)]

    def objective(trial):
        params = {
            "objective": "tweedie",
            "tweedie_variance_power": trial.suggest_float("tvp", 1.1, 1.6),
            "metric": "rmse",
            "learning_rate": trial.suggest_float("lr", 0.02, 0.08, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 63, 511),
            "max_depth": trial.suggest_int("max_depth", 6, 12),
            "min_data_in_leaf": trial.suggest_int("min_leaf", 50, 300),
            "feature_fraction": trial.suggest_float("ff", 0.5, 0.9),
            "bagging_fraction": trial.suggest_float("bf", 0.6, 0.95),
            "bagging_freq": 1,
            "lambda_l1": trial.suggest_float("l1", 1e-3, 1.0, log=True),
            "lambda_l2": trial.suggest_float("l2", 1e-3, 1.0, log=True),
            "verbose": -1,
            "n_jobs": -1,
            "seed": 42,
        }
        mask_train = fp["Date"] < VAL_START_TS
        mask_val = fp["Date"] >= VAL_START_TS
        dtrain = lgb.Dataset(
            fp.loc[mask_train, feat_cols],
            label=fp.loc[mask_train, "qty"],
            weight=(
                fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])
            ).values,
            free_raw_data=True,
        )
        dval = lgb.Dataset(
            fp.loc[mask_val, feat_cols],
            label=fp.loc[mask_val, "qty"],
            weight=(fp.loc[mask_val, "weight"] / np.sqrt(fp.loc[mask_val, "wrmsse_denom"])).values,
            reference=dtrain,
            free_raw_data=True,
        )
        model = lgb.train(
            params,
            dtrain,
            num_boost_round=500,
            valid_sets=[dval],
            feval=wrmsse_feval,
            callbacks=[lgb.early_stopping(50, verbose=False)],
        )
        y_true_list = []
        y_pred_list = []
        weights = []
        denoms = []
        for sku in sub_skus:
            sub = holdout[holdout["ItemCode"] == sku]
            if len(sub) == 0:
                continue
            w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0
            if w <= 0:
                continue
            y_true_list.append(sub["qty"].values)
            y_pred_list.append(model.predict(sub[feat_cols]))
            weights.append(w)
            denoms.append(float(sku_weights.loc[sku, "wrmsse_denom"]))
        if not y_true_list:
            return 1.0
        return compute_wrmsse(
            np.array(y_true_list),
            np.array(y_pred_list),
            np.array(weights),
            np.array(denoms),
        )

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=OPTUNA_TRIALS, show_progress_bar=True)
    best = study.best_params
    out = PROC_DIR / "optuna_best_lgbm.json"
    import json

    with open(out, "w") as f:
        json.dump(best, f, indent=2)
    print(f"Best WRMSSE {study.best_value:.6f} → {out}")
    print(best)


if __name__ == "__main__":
    main()
