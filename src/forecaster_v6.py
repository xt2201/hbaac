"""
HBAAC V6 Forecaster — ensemble + direct multi-horizon + tiered post-process.
"""

import argparse
import json
import warnings
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    DATA_DIR,
    DATA_START,
    DIRECT_BLEND_PATH,
    ENSEMBLE_BLEND_PATH,
    FEATURE_PANEL_V6,
    HORIZON,
    HOLDOUT_START,
    MODEL_DIR,
    PROC_DIR,
    SUB_DIR,
    TAIL_TXN_MAX,
    TOP_BIAS_MATRIX_PATH,
    TOP_TIER_N,
    TRAIN_END,
    VALID_START,
    LGBM_SEEDS,
)
from direct_horizon import (
    blend_direct_recursive,
    predict_direct_56,
    train_direct_model,
    tune_direct_blend_alphas,
)
from ensemble import (
    fit_stack_weights,
    load_all_models,
    predict_holdout_oof,
    stack_predict_day,
    train_all_models,
    train_lgbm_v6,
)
from eval_wrmsse import (
    eval_horizon_buckets,
    load_sku_weights,
    print_eval_report,
    print_horizon_report,
)
from intermittent import (
    build_croston_matrix,
    load_two_stage_models,
    train_two_stage_models,
    two_stage_predict,
)
from postprocess import apply_postprocess, build_magic_mult_array
from top_sku_model import (
    apply_top_bias,
    fit_horizon_bias_matrix,
    get_top_skus,
    train_top200_model,
)
from v5_features import enrich_panel
from v6_features import FEAT_COLS_V6

warnings.filterwarnings("ignore")

parser = argparse.ArgumentParser()
parser.add_argument("--skip-train", action="store_true")
parser.add_argument("--fast", action="store_true", help="3 LGBM seeds only")
args = parser.parse_args()

print("=" * 70)
print("HBAAC  |  V6 Forecaster")
print("=" * 70)

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VALID_START_TS = pd.Timestamp(VALID_START)
T0 = pd.Timestamp(DATA_START)

sample_sub = pd.read_csv(DATA_DIR / "sample_submission.csv")
f_cols = [f"F{i}" for i in range(1, 29)]
sub_skus = sorted(
    sample_sub["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)
sku_cat_dtype = pd.CategoricalDtype(categories=sub_skus, ordered=False)
sku_weights = load_sku_weights()
top_tier_skus = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)
top200_skus = get_top_skus(sku_weights)

panel_path = FEATURE_PANEL_V6 if FEATURE_PANEL_V6.exists() else PROC_DIR / "feature_panel.parquet"
if not panel_path.exists():
    raise FileNotFoundError("Run feature_builder_v6.py or feature_builder.py first")

_panel_cols = None  # load all columns; slice dates after read
fp = pd.read_parquet(panel_path, columns=_panel_cols)
fp["Date"] = pd.to_datetime(fp["Date"])
if args.skip_train:
    fp = fp[fp["Date"] >= TRAIN_END_TS - pd.Timedelta(days=150)]
fp = enrich_panel(fp, sub_skus)

MODEL_DIR.mkdir(exist_ok=True)
PROC_DIR.mkdir(exist_ok=True)

# ─── Train ───────────────────────────────────────────────────────────────────
if not args.skip_train:
    print("\n[1/7] Ensemble …")
    if args.fast:
        for seed in LGBM_SEEDS[:3]:
            train_lgbm_v6(fp, sub_skus, seed, MODEL_DIR / f"lgbm_v6_s{seed}.txt")
    else:
        train_all_models(fp, sub_skus, skip_existing=True)

    print("\n[2-4/7] Run: python scripts/train_aux_models.py (direct + top200, memory-safe)")
else:
    print("\n[1-4/7] Skip training")

models = load_all_models(sub_skus)
if not models:
    raise RuntimeError("No V6 models in models/ — run train_ensemble.py")

direct_path = MODEL_DIR / "lgbm_v6_direct.txt"
top_path = MODEL_DIR / "lgbm_v6_top200.txt"
direct_model = (
    lgb.Booster(model_file=str(direct_path)) if direct_path.exists() else None
)
top_model = lgb.Booster(model_file=str(top_path)) if top_path.exists() else None
zi_clf, zi_reg = load_two_stage_models()

# Stack weights
print("\n[5/7] Ensemble stack weights …")
if not ENSEMBLE_BLEND_PATH.exists() or not args.skip_train:
    oof, dates = predict_holdout_oof(fp, sub_skus, models)
    txn_counts = pd.read_csv(DATA_DIR / "train.csv", usecols=["ItemCode"]).groupby("ItemCode").size().to_dict()
    holdout_fp = fp[(fp["Date"] >= pd.Timestamp(HOLDOUT_START)) & (fp["Date"] <= TRAIN_END_TS)]
    actuals = np.zeros((len(dates), len(sub_skus)), dtype=np.float32)
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    for di, d in enumerate(dates):
        day = holdout_fp[holdout_fp["Date"] == d]
        for _, row in day.iterrows():
            actuals[di, sku_to_i[row["ItemCode"]]] = row["qty"]
    blend_cfg = fit_stack_weights(oof, actuals, sub_skus, sku_weights, txn_counts)
else:
    with open(ENSEMBLE_BLEND_PATH) as f:
        blend_cfg = json.load(f)

if top_model and (not TOP_BIAS_MATRIX_PATH.exists() or not args.skip_train):
    print("\n[6/7] Top-200 bias matrix …")
    fit_horizon_bias_matrix(top_model, fp, sub_skus, top200_skus)
bias_matrix = (
    np.load(TOP_BIAS_MATRIX_PATH) if TOP_BIAS_MATRIX_PATH.exists() else np.zeros((len(sub_skus), HORIZON))
)

# Daily matrices
print("\n[7/7] Recursive forecast + blend …")
train_raw = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train_raw["Date"] = pd.to_datetime(train_raw["Date"])
train_raw["Quantity"] = pd.to_numeric(train_raw["Quantity"], errors="coerce").fillna(0).astype(int)

daily_net = train_raw.groupby(["Date", "ItemCode"]).agg(qty=("Quantity", "sum")).reset_index()
daily_net["qty"] = daily_net["qty"].clip(lower=0)
daily_qty = daily_net.pivot_table(index="Date", columns="ItemCode", values="qty", fill_value=0)
all_dates = pd.date_range(daily_qty.index.min(), daily_qty.index.max(), freq="D")
daily_qty = daily_qty.reindex(all_dates, fill_value=0)
for s in sub_skus:
    if s not in daily_qty.columns:
        daily_qty[s] = 0
daily_qty = daily_qty[sub_skus]

txn_counts = train_raw.groupby("ItemCode").size().to_dict()
tier_top = np.array([s in top_tier_skus for s in sub_skus])
tier_tail = np.array([txn_counts.get(s, 0) <= TAIL_TXN_MAX for s in sub_skus])
tier_mid = ~(tier_top | tier_tail)
top200_mask = np.array([s in top200_skus for s in sub_skus])

recent = daily_qty.iloc[-56:]
dow_naive = np.zeros((7, len(sub_skus)), dtype=np.float32)
for dow in range(7):
    rows = recent.loc[recent.index.dayofweek == dow]
    if len(rows) > 0:
        dow_naive[dow, :] = rows.mean(axis=0).values

lgbm_hist = daily_qty.values.astype(np.float32)
n_hist = len(lgbm_hist)
lgbm_ext = np.vstack([lgbm_hist, np.zeros((HORIZON, len(sub_skus)), dtype=np.float32)])

stats = pd.read_csv(PROC_DIR / "sku_stats.csv").set_index("ItemCode")
sku_p90_arr = np.array(
    [float(stats.loc[s, "sku_p90"]) if s in stats.index else 0 for s in sub_skus],
    dtype=np.float32,
)
magic_mult = build_magic_mult_array(len(sub_skus), tier_top, tier_tail)

feat_cols_rec = list(dict.fromkeys(c for c in FEAT_COLS_V6 if c in fp.columns))
col_map = {c: i for i, c in enumerate(feat_cols_rec)}
cat_codes = pd.Series(sub_skus).astype(sku_cat_dtype).cat.codes.values
anchor_rows = fp[fp["Date"] == TRAIN_END_TS].set_index("ItemCode")

lgbm_preds = np.zeros((HORIZON, len(sub_skus)), dtype=np.float32)
forecast_dates = pd.date_range(VALID_START_TS, periods=HORIZON, freq="D")
croston_full = build_croston_matrix(daily_qty, sub_skus, HORIZON)

for day_idx, fdate in enumerate(forecast_dates):
    row_idx = n_hist + day_idx
    n = len(sub_skus)
    feat = np.zeros((n, len(feat_cols_rec)), dtype=np.float32)

    dow, dom, month = fdate.dayofweek, fdate.day, fdate.month
    trend = (fdate - T0).days

    for i, sku in enumerate(sub_skus):
        if sku in anchor_rows.index:
            row = anchor_rows.loc[sku]
            if isinstance(row, pd.DataFrame):
                row = row.iloc[-1]
            for c in feat_cols_rec:
                if c in row.index and c in col_map:
                    feat[i, col_map[c]] = row[c]

    for key, val in [
        ("dayofweek", dow),
        ("dayofmonth", dom),
        ("month", month),
        ("is_saturday", 1 if dow == 5 else 0),
        ("is_sunday", 1 if dow == 6 else 0),
        ("is_october", 1 if month == 10 else 0),
        ("trend", trend),
        ("ItemCode_cat", None),
    ]:
        if key in col_map:
            if key == "ItemCode_cat":
                feat[:, col_map[key]] = cat_codes
            else:
                feat[:, col_map[key]] = val

    for lag, cn in [(1, "lag_1"), (2, "lag_2"), (3, "lag_3"), (7, "lag_7"), (14, "lag_14"), (21, "lag_21"), (28, "lag_28")]:
        if cn in col_map:
            idx = row_idx - lag
            if idx >= 0:
                feat[:, col_map[cn]] = lgbm_ext[idx, :]

    for w, pfx in [(7, "roll_mean_7"), (14, "roll_mean_14"), (28, "roll_mean_28")]:
        if pfx in col_map:
            start = max(0, row_idx - w)
            win = lgbm_ext[start:row_idx, :]
            if len(win) > 0:
                feat[:, col_map[pfx]] = win.mean(axis=0)

    Xdf = pd.DataFrame(feat, columns=feat_cols_rec)
    pred = stack_predict_day(Xdf, sub_skus, models, blend_cfg, tier_top, tier_tail)

    # Top-200 specialist blend
    if top_model is not None and top200_mask.any():
        top_pred = top_model.predict(Xdf[feat_cols_rec])
        pred[top200_mask] = 0.55 * pred[top200_mask] + 0.45 * top_pred[top200_mask]

    # Tail: Croston + optional two-stage
    if tier_tail.any():
        pred[tier_tail] = 0.5 * pred[tier_tail] + 0.5 * croston_full[tier_tail, day_idx]
        if zi_clf is not None and zi_reg is not None:
            zi_p = two_stage_predict(zi_clf, zi_reg, Xdf.iloc[np.where(tier_tail)[0]], feat_cols_rec)
            pred[tier_tail] = 0.7 * pred[tier_tail] + 0.3 * zi_p

    pred = apply_postprocess(
        pred, dow, tier_top, tier_tail, magic_mult, dow_naive[dow], sku_p90_arr, top_bias=None
    )
    lgbm_preds[day_idx, :] = pred
    lgbm_ext[row_idx, :] = pred

    if (day_idx + 1) % 14 == 0:
        print(f"  day {day_idx + 1}/{HORIZON} mean={pred.mean():.4f}")

recursive_56 = lgbm_preds.T
np.save(PROC_DIR / "recursive_56.npy", recursive_56)

if direct_model is not None:
    fp_anchor = fp[fp["Date"] <= TRAIN_END_TS]
    direct_56 = predict_direct_56(direct_model, fp_anchor, sub_skus, sku_cat_dtype)
    np.save(PROC_DIR / "direct_56.npy", direct_56)
    if DIRECT_BLEND_PATH.exists() and args.skip_train:
        with open(DIRECT_BLEND_PATH) as f:
            alphas = np.array(json.load(f)["alphas"], dtype=np.float32)
    else:
        alphas = tune_direct_blend_alphas(direct_56, recursive_56, daily_qty, sub_skus, sku_weights)
    final_56 = blend_direct_recursive(direct_56, recursive_56, alphas)
    alphas_heavy = alphas.copy()
    alphas_heavy[21:] = 1.0
    final_heavy = blend_direct_recursive(direct_56, recursive_56, alphas_heavy)
else:
    print("  No direct model — using recursive only")
    direct_56 = recursive_56.copy()
    np.save(PROC_DIR / "direct_56.npy", direct_56)
    final_56 = recursive_56.copy()
    final_heavy = recursive_56.copy()
final_56 = apply_top_bias(final_56, bias_matrix, sub_skus, top200_skus)
np.save(PROC_DIR / "final_56.npy", final_56)
for day_idx, fdate in enumerate(forecast_dates):
    if fdate.dayofweek == 6:
        final_56[:, day_idx] = 0.0

final_heavy = apply_top_bias(final_heavy, bias_matrix, sub_skus, top200_skus)
for day_idx, fdate in enumerate(forecast_dates):
    if fdate.dayofweek == 6:
        final_heavy[:, day_idx] = 0.0

preds_val = np.clip(final_56[:, :28], 0, None)
preds_eval = np.clip(final_56[:, 28:], 0, None)

report = eval_horizon_buckets(daily_qty, final_56, sub_skus, sku_weights, TRAIN_END_TS)
print_horizon_report(report, prefix="V6 ")
print_eval_report(daily_qty, preds_val, preds_eval, sub_skus, sku_weights)


def _save_submission(preds_56: np.ndarray, path: Path) -> None:
    val = np.clip(preds_56[:, :28], 0, None)
    ev = np.clip(preds_56[:, 28:], 0, None)
    val_df = pd.DataFrame(val, columns=f_cols)
    val_df.insert(0, "id", [f"{s}_validation" for s in sub_skus])
    eval_df = pd.DataFrame(ev, columns=f_cols)
    eval_df.insert(0, "id", [f"{s}_evaluation" for s in sub_skus])
    out = pd.concat([val_df, eval_df], ignore_index=True)
    out = out.set_index("id").reindex(sample_sub["id"].values).reset_index()
    path.parent.mkdir(exist_ok=True)
    out.to_csv(path, index=False)
    print(f"  Saved → {path}")


_save_submission(final_56, SUB_DIR / "submission_v6.csv")
_save_submission(final_heavy, SUB_DIR / "submission_v6_direct_heavy.csv")
print("\nDone!")
