"""
Tune direct/recursive blend alphas on holdout (requires trained V6 models).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, FEATURE_PANEL_V6, PROC_DIR, TRAIN_END
from direct_horizon import blend_direct_recursive, predict_direct_56, tune_direct_blend_alphas
from eval_wrmsse import load_sku_weights, print_horizon_report, eval_horizon_buckets
import lightgbm as lgb

TRAIN_END_TS = pd.Timestamp(TRAIN_END)

sample = pd.read_csv(DATA_DIR / "sample_submission.csv")
sub_skus = sorted(
    sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)
sku_weights = load_sku_weights()

panel_path = FEATURE_PANEL_V6 if FEATURE_PANEL_V6.exists() else PROC_DIR / "feature_panel.parquet"
fp = pd.read_parquet(panel_path)
fp["Date"] = pd.to_datetime(fp["Date"])

train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0)
daily = (
    train.groupby(["Date", "ItemCode"])["Quantity"]
    .sum()
    .reset_index()
    .pivot(index="Date", columns="ItemCode", values="Quantity")
    .fillna(0)
)
for s in sub_skus:
    if s not in daily.columns:
        daily[s] = 0
daily = daily[sub_skus]

# Load preds from saved recursive + direct (user must have run forecaster partial)
# This script only tunes alphas if recursive_56.npy and direct_56.npy exist
rec_path = PROC_DIR / "recursive_56.npy"
dir_path = PROC_DIR / "direct_56.npy"
if not rec_path.exists() or not dir_path.exists():
    print("Run forecaster_v6.py first to generate recursive_56.npy / direct_56.npy")
    sys.exit(1)

recursive = np.load(rec_path)
direct = np.load(dir_path)
alphas = tune_direct_blend_alphas(direct, recursive, daily, sub_skus, sku_weights)
final = blend_direct_recursive(direct, recursive, alphas)
report = eval_horizon_buckets(daily, final, sub_skus, sku_weights, TRAIN_END_TS)
print_horizon_report(report, prefix="Blend ")
