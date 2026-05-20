"""
Train V6 ensemble (LGBM multi-seed + CatBoost) and auxiliary models.
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, FEATURE_PANEL_V6, LGBM_SEEDS, PROC_DIR
from direct_horizon import train_direct_model
from ensemble import train_all_models, train_lgbm_v6
from intermittent import train_two_stage_models
from top_sku_model import get_top_skus, train_top200_model
from eval_wrmsse import load_sku_weights
from v5_features import enrich_panel

parser = argparse.ArgumentParser()
parser.add_argument("--fast", action="store_true", help="Train 3 LGBM seeds only")
args = parser.parse_args()

print("=" * 70)
print("HBAAC  |  Train V6 Ensemble")
print("=" * 70)

sample = pd.read_csv(DATA_DIR / "sample_submission.csv")
sub_skus = sorted(
    sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)

panel_path = FEATURE_PANEL_V6
if not panel_path.exists():
    panel_path = PROC_DIR / "feature_panel.parquet"
    print(f"  V6 panel missing — using {panel_path}")

fp = pd.read_parquet(panel_path)
fp["Date"] = pd.to_datetime(fp["Date"])
fp = enrich_panel(fp, sub_skus)
sku_cat = pd.CategoricalDtype(categories=sub_skus, ordered=False)

sku_weights = load_sku_weights()
top200 = get_top_skus(sku_weights)
txn = pd.read_csv(DATA_DIR / "train.csv", usecols=["ItemCode"]).groupby("ItemCode").size()
tail_skus = [s for s in sub_skus if txn.get(s, 0) <= 10]

from config import MODEL_DIR

MODEL_DIR.mkdir(exist_ok=True)

if args.fast:
    for seed in LGBM_SEEDS[:3]:
        p = MODEL_DIR / f"lgbm_v6_s{seed}.txt"
        print(f"  LGBM seed={seed}")
        train_lgbm_v6(fp, sub_skus, seed, p)
else:
    train_all_models(fp, sub_skus, skip_existing=True)

print("\n  Direct horizon model …")
train_direct_model(fp, sub_skus, sku_cat, MODEL_DIR / "lgbm_v6_direct.txt")

print("\n  Top-200 model …")
train_top200_model(fp, sub_skus, top200, MODEL_DIR / "lgbm_v6_top200.txt")

if not args.fast:
    print("\n  Two-stage tail models …")
    train_two_stage_models(fp, sub_skus, tail_skus[:1500])
else:
    print("\n  Skip two-stage tail (--fast)")

print("\nDone.")
