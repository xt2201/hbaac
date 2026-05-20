"""
Grid-search MAGIC_MULT on aligned holdout WRMSSE (last 28 days of train).
Requires trained model: models/lgbm_v5.txt
"""

import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import (  # noqa: E402
    DATA_DIR,
    MAGIC_MULT_TOP_TIER,
    MODEL_DIR,
    PROC_DIR,
    TOP_TIER_N,
    TRAIN_END,
    VAL_DAYS,
)
from eval_wrmsse import load_sku_weights  # noqa: E402
from v5_features import FEAT_COLS, enrich_panel  # noqa: E402

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
holdout_start = TRAIN_END_TS - pd.Timedelta(days=27)

print("Loading model & panel …")
model = lgb.Booster(model_file=str(MODEL_DIR / "lgbm_v5.txt"))

sample_sub = pd.read_csv(DATA_DIR / "sample_submission.csv")
sub_skus = sorted(
    sample_sub["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)
sku_weights = load_sku_weights()
top_tier = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)

fp = pd.read_parquet(PROC_DIR / "feature_panel.parquet")
fp["Date"] = pd.to_datetime(fp["Date"])
fp = enrich_panel(fp, sub_skus)

mask_holdout = (fp["Date"] >= holdout_start) & (fp["Date"] <= TRAIN_END_TS)
holdout_df = fp.loc[mask_holdout].copy()

raw_pred = model.predict(holdout_df[FEAT_COLS])

best_magic = 0.96
best_score = float("inf")

print(f"\nHoldout {holdout_start.date()} .. {TRAIN_END_TS.date()}\n")
print(f"{'MAGIC':>6}  {'WRMSSE':>10}")
print("-" * 20)

for magic in np.arange(0.88, 1.01, 0.02):
    holdout_df["pred"] = raw_pred.copy()
    for sku in sub_skus:
        is_top = sku in top_tier
        m = MAGIC_MULT_TOP_TIER if is_top else magic
        holdout_df.loc[holdout_df["ItemCode"] == sku, "pred"] *= m

    score = 0.0
    for sku in sub_skus:
        w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0.0
        if w <= 0:
            continue
        denom = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
        sub = holdout_df[holdout_df["ItemCode"] == sku]
        if len(sub) == 0:
            continue
        rmse = np.sqrt(np.mean((sub["qty"].values - sub["pred"].values) ** 2))
        score += w * (rmse / np.sqrt(denom))

    print(f"{magic:6.2f}  {score:10.6f}")
    if score < best_score:
        best_score = score
        best_magic = magic

print(f"\nBest MAGIC_MULT_DEFAULT = {best_magic:.2f}  (WRMSSE = {best_score:.6f})")
print("Update src/config.py MAGIC_MULT_DEFAULT and re-run forecaster.")
