"""
Train direct + top200 with memory-safe parquet filters.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, FEATURE_PANEL_V6, MODEL_DIR, TOP_TIER_200
from direct_horizon import train_direct_model
from top_sku_model import get_top_skus, train_top200_model
from eval_wrmsse import load_sku_weights
from v5_features import enrich_panel

print("=" * 70)
print("HBAAC  |  Train auxiliary models (memory-safe)")
print("=" * 70)

sample = pd.read_csv(DATA_DIR / "sample_submission.csv")
sub_skus = sorted(
    sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)
sku_weights = load_sku_weights()
top200 = get_top_skus(sku_weights, TOP_TIER_200)
sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)

MODEL_DIR.mkdir(exist_ok=True)

# Top-200: filter rows at read time
print("\n[1/2] Top-200 model …")
top_path = MODEL_DIR / "lgbm_v6_top200.txt"
if top_path.exists():
    print(f"  Skip existing {top_path.name}")
else:
    fp_top = pd.read_parquet(FEATURE_PANEL_V6, filters=[("ItemCode", "in", top200)])
    fp_top["Date"] = pd.to_datetime(fp_top["Date"])
    fp_top = enrich_panel(fp_top, sub_skus)
    train_top200_model(fp_top, sub_skus, top200, top_path)
    del fp_top

# Direct: last ~18 months, horizons 1-28 only, subsampled
print("\n[2/2] Direct horizon model …")
direct_path = MODEL_DIR / "lgbm_v6_direct.txt"
if direct_path.exists():
    print(f"  Skip existing {direct_path.name}")
else:
    from config import DIRECT_MAX_TRAIN_ROWS, HORIZON
    from direct_horizon import build_horizon_training_frame
    import lightgbm as lgb
    from v6_features import FEAT_COLS_DIRECT
    from wrmsse_feval import wrmsse_feval
    from config import TRAIN_END, VAL_DAYS

    TRAIN_END_TS = pd.Timestamp(TRAIN_END)
    VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)

    fp = pd.read_parquet(FEATURE_PANEL_V6)
    fp["Date"] = pd.to_datetime(fp["Date"])
    fp = fp[fp["Date"] >= pd.Timestamp("2024-01-01")]
    fp = enrich_panel(fp, sub_skus)
    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat).cat.codes
    df = build_horizon_training_frame(
        fp, horizons=list(range(1, 29)), max_rows=min(DIRECT_MAX_TRAIN_ROWS, 600_000)
    )
    del fp
    feat_cols = list(dict.fromkeys(c for c in FEAT_COLS_DIRECT if c in df.columns))
    mask_train = df["Date"] < VAL_START_TS
    mask_val = df["Date"] >= VAL_START_TS
    dtrain = lgb.Dataset(
        df.loc[mask_train, feat_cols],
        label=df.loc[mask_train, "target_fwd"],
        weight=(df.loc[mask_train, "weight"] / np.sqrt(df.loc[mask_train, "wrmsse_denom"])).values,
        categorical_feature=["ItemCode_cat"],
        free_raw_data=True,
    )
    dval = lgb.Dataset(
        df.loc[mask_val, feat_cols],
        label=df.loc[mask_val, "target_fwd"],
        weight=(df.loc[mask_val, "weight"] / np.sqrt(df.loc[mask_val, "wrmsse_denom"])).values,
        reference=dtrain,
        free_raw_data=True,
    )
    model = lgb.train(
        {
            "objective": "tweedie",
            "tweedie_variance_power": 1.2,
            "metric": "rmse",
            "learning_rate": 0.05,
            "num_leaves": 127,
            "max_depth": 9,
            "min_data_in_leaf": 200,
            "feature_fraction": 0.6,
            "verbose": -1,
            "n_jobs": -1,
            "seed": 42,
        },
        dtrain,
        num_boost_round=1200,
        valid_sets=[dval],
        feval=wrmsse_feval,
        callbacks=[lgb.early_stopping(80, verbose=False)],
    )
    model.save_model(str(direct_path))
    print(f"  Saved {direct_path.name}")

print("\nDone.")
