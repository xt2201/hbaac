"""
Step 4: V5 Forecaster — EDA-driven WRMSSE pipeline
"""

import argparse
import warnings

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    DATA_DIR,
    DATA_START,
    HORIZON,
    MAGIC_MULT_DEFAULT,
    MAGIC_MULT_TAIL,
    MAGIC_MULT_TOP_TIER,
    MODEL_DIR,
    P90_CAP_MULT,
    PROC_DIR,
    SUB_DIR,
    TAIL_BLEND_ALPHA,
    TAIL_TXN_MAX,
    TOP_TIER_N,
    TRAIN_END,
    VALID_START,
    VAL_DAYS,
)
from eval_wrmsse import load_sku_weights
from v5_features import ALL_HOLIDAYS, FEAT_COLS, days_to_next_holiday, enrich_panel

warnings.filterwarnings("ignore")

parser = argparse.ArgumentParser()
parser.add_argument(
    "--forecast-only",
    action="store_true",
    help="Skip training; load models/lgbm_v5.txt and only forecast",
)
args = parser.parse_args()

print("=" * 70)
print("HBAAC  |  Step 4: V5 Forecaster")
print("=" * 70)

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
VALID_START_TS = pd.Timestamp(VALID_START)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)
T0 = pd.Timestamp(DATA_START)

all_holidays = ALL_HOLIDAYS

# ─── Load submission SKUs ─────────────────────────────────────────────────────
print("\n[1/7] Loading data …")
sample_sub = pd.read_csv(DATA_DIR / "sample_submission.csv")
f_cols = [f"F{i}" for i in range(1, 29)]
sub_skus = sorted(
    sample_sub["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
)
sku_cat_dtype = pd.CategoricalDtype(categories=sub_skus, ordered=False)
sku_weights = load_sku_weights()

top_tier_skus = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)
print(f"  Sub SKUs: {len(sub_skus):,}  |  Top tier: {len(top_tier_skus)}")

# ─── Feature panel + V5 extras ──────────────────────────────────────────────────
print("\n[2/7] Building V5 features on panel …")
fp = pd.read_parquet(PROC_DIR / "feature_panel.parquet")
fp["Date"] = pd.to_datetime(fp["Date"])
fp = enrich_panel(fp, sub_skus)

model_path = MODEL_DIR / "lgbm_v5.txt"
wrmsse_holdout = None

if args.forecast_only and model_path.exists():
    print("\n[3/7] Skipping training (--forecast-only) …")
    model = lgb.Booster(model_file=str(model_path))
    print(f"  Loaded {model_path}")
else:
    # ─── Train LGBM ───────────────────────────────────────────────────────────
    print("\n[3/7] Training LGBM V5 …")
    mask_train = fp["Date"] < VAL_START_TS
    mask_val = fp["Date"] >= VAL_START_TS

    X_train = fp.loc[mask_train, FEAT_COLS]
    y_train = fp.loc[mask_train, "qty"]
    w_train = (
        fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])
    ).values * fp.loc[mask_train, "decay_weight"].values

    X_val = fp.loc[mask_val, FEAT_COLS]
    y_val = fp.loc[mask_val, "qty"]
    w_val = (fp.loc[mask_val, "weight"] / np.sqrt(fp.loc[mask_val, "wrmsse_denom"])).values

    print(f"  Train rows: {X_train.shape[0]:,}  Val rows: {X_val.shape[0]:,}")

    dtrain = lgb.Dataset(
        X_train,
        label=y_train,
        weight=w_train,
        categorical_feature=["ItemCode_cat"],
        feature_name=FEAT_COLS,
        free_raw_data=True,
    )
    dval = lgb.Dataset(
        X_val,
        label=y_val,
        weight=w_val,
        categorical_feature=["ItemCode_cat"],
        reference=dtrain,
        free_raw_data=True,
    )

    params = {
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
        "seed": 42,
    }

    model = lgb.train(
        params=params,
        train_set=dtrain,
        num_boost_round=3000,
        valid_sets=[dval],
        valid_names=["val"],
        callbacks=[
            lgb.early_stopping(150, verbose=True),
            lgb.log_evaluation(100),
        ],
    )
    model.save_model(str(model_path))
    print(f"  Model V5 best_iter={model.best_iteration}")

    print("\n[4/7] Holdout WRMSSE (last 28d of train) …")
    holdout_start = TRAIN_END_TS - pd.Timedelta(days=27)
    mask_holdout = (fp["Date"] >= holdout_start) & (fp["Date"] <= TRAIN_END_TS)
    holdout_pred = model.predict(fp.loc[mask_holdout, FEAT_COLS])
    holdout_df = fp.loc[mask_holdout, ["ItemCode", "Date", "qty", "weight", "wrmsse_denom"]].copy()
    holdout_df["pred"] = holdout_pred

    wrmsse_holdout = 0.0
    for sku in sub_skus:
        w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0.0
        if w <= 0:
            continue
        denom = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
        sub = holdout_df[holdout_df["ItemCode"] == sku]
        if len(sub) == 0:
            continue
        rmse = np.sqrt(np.mean((sub["qty"].values - sub["pred"].values) ** 2))
        wrmsse_holdout += w * (rmse / np.sqrt(denom))
    print(f"  Holdout WRMSSE (aligned {holdout_start.date()}..{TRAIN_END_TS.date()}): {wrmsse_holdout:.6f}")

# ─── Load daily matrices for recursive forecast ───────────────────────────────
print("\n[5/7] Recursive 56-day forecast …")
train_raw = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train_raw["Date"] = pd.to_datetime(train_raw["Date"])
train_raw["Quantity"] = pd.to_numeric(train_raw["Quantity"], errors="coerce").fillna(0).astype(int)
train_raw["SalesAmount"] = pd.to_numeric(train_raw["SalesAmount"], errors="coerce").fillna(0)

daily_net = (
    train_raw.groupby(["Date", "ItemCode"])
    .agg(qty=("Quantity", "sum"), sales=("SalesAmount", "sum"), ret=("Quantity", lambda x: x[x < 0].sum()))
    .reset_index()
)
daily_net["qty"] = daily_net["qty"].clip(lower=0)
daily_net["ret"] = daily_net["ret"].abs()

daily_qty = daily_net.pivot_table(index="Date", columns="ItemCode", values="qty", fill_value=0)
daily_sales = daily_net.pivot_table(index="Date", columns="ItemCode", values="sales", fill_value=0)
daily_ret = daily_net.pivot_table(index="Date", columns="ItemCode", values="ret", fill_value=0)

all_dates = pd.date_range(daily_qty.index.min(), daily_qty.index.max(), freq="D")
daily_qty = daily_qty.reindex(all_dates, fill_value=0)
daily_sales = daily_sales.reindex(all_dates, fill_value=0)
daily_ret = daily_ret.reindex(all_dates, fill_value=0)

for s in sub_skus:
    if s not in daily_qty.columns:
        daily_qty[s] = 0
        daily_sales[s] = 0
        daily_ret[s] = 0
daily_qty = daily_qty[sub_skus]
daily_sales = daily_sales[sub_skus]
daily_ret = daily_ret[sub_skus]

# Production SKU stats (full history to TRAIN_END)
txn_counts = train_raw.groupby("ItemCode").size().to_dict()

lgbm_stats_df = pd.DataFrame(index=sub_skus)
last_known_prices = []
current_streaks = []
last_return_rate = []

for sku in sub_skus:
    col = daily_qty[sku]
    nz = col[col > 0]
    lgbm_stats_df.loc[sku, "sku_mean"] = float(col.mean())
    lgbm_stats_df.loc[sku, "sku_std"] = float(col.std()) if col.std() > 0 else 0
    lgbm_stats_df.loc[sku, "sku_median"] = float(col.median())
    lgbm_stats_df.loc[sku, "sku_max"] = float(col.max())
    lgbm_stats_df.loc[sku, "sku_p90"] = float(nz.quantile(0.9)) if len(nz) > 0 else 0
    lgbm_stats_df.loc[sku, "sku_active_rate"] = float((col > 0).mean())

    sales_col = daily_sales[sku]
    prices = np.where(col > 0, sales_col / col, np.nan)
    last_known_prices.append(float(pd.Series(prices).ffill().fillna(0).values[-1]))

    if len(nz) == 0:
        current_streaks.append(len(col))
    else:
        last_active_idx = col.to_numpy().nonzero()[0][-1]
        current_streaks.append(len(col) - 1 - last_active_idx)

    ret_col = daily_ret[sku]
    q_sum = col.iloc[-28:].sum()
    r_sum = ret_col.iloc[-28:].sum()
    last_return_rate.append(float(r_sum / (q_sum + 1e-6)))

last_known_prices = np.array(last_known_prices, dtype=np.float32)
current_streaks = np.array(current_streaks, dtype=np.float32)
last_return_rate = np.array(last_return_rate, dtype=np.float32)
txn_count_log = np.array([np.log1p(txn_counts.get(s, 0)) for s in sub_skus], dtype=np.float32)

# Tier masks
tier_top = np.array([s in top_tier_skus for s in sub_skus])
tier_tail = np.array([txn_counts.get(s, 0) <= TAIL_TXN_MAX for s in sub_skus])

# DOW seasonal naive (last 56 days, for tail blend)
recent = daily_qty.iloc[-56:]
dow_naive = np.zeros((7, len(sub_skus)), dtype=np.float32)
for dow in range(7):
    rows = recent.loc[recent.index.dayofweek == dow]
    if len(rows) > 0:
        dow_naive[dow, :] = rows.mean(axis=0).values

lgbm_hist = daily_qty.values.astype(np.float32)
n_hist = len(lgbm_hist)
lgbm_ext = np.vstack([lgbm_hist, np.zeros((HORIZON, len(sub_skus)), dtype=np.float32)])

forecast_dates = pd.date_range(VALID_START_TS, periods=HORIZON, freq="D")
col_map = {c: i for i, c in enumerate(FEAT_COLS)}
cat_codes = pd.Series(sub_skus).astype(sku_cat_dtype).cat.codes.values

lgbm_preds = np.zeros((HORIZON, len(sub_skus)), dtype=np.float32)
magic_mult_arr = np.where(tier_top, MAGIC_MULT_TOP_TIER, MAGIC_MULT_DEFAULT).astype(np.float32)
magic_mult_arr[tier_tail] = MAGIC_MULT_TAIL

for day_idx, fdate in enumerate(forecast_dates):
    row_idx = n_hist + day_idx
    n = len(sub_skus)
    feat = np.zeros((n, len(FEAT_COLS)), dtype=np.float32)

    dow, dom, month, qtr = fdate.dayofweek, fdate.day, fdate.month, fdate.quarter
    doy, woy, year = fdate.dayofyear, fdate.isocalendar()[1], fdate.year
    trend = (fdate - T0).days

    feat[:, col_map["ItemCode_cat"]] = cat_codes
    feat[:, col_map["price_lag1"]] = last_known_prices
    feat[:, col_map["days_since_last_sale_lag1"]] = current_streaks
    feat[:, col_map["return_rate_28d"]] = last_return_rate
    feat[:, col_map["txn_count_log"]] = txn_count_log
    feat[:, col_map["is_holiday"]] = 1 if fdate in all_holidays else 0
    feat[:, col_map["days_to_next_holiday"]] = days_to_next_holiday(fdate)
    feat[:, col_map["dayofweek"]] = dow
    feat[:, col_map["dayofmonth"]] = dom
    feat[:, col_map["month"]] = month
    feat[:, col_map["quarter"]] = qtr
    feat[:, col_map["dayofyear"]] = doy
    feat[:, col_map["weekofyear"]] = woy
    feat[:, col_map["year"]] = year
    feat[:, col_map["is_weekend"]] = 1 if dow >= 5 else 0
    feat[:, col_map["is_saturday"]] = 1 if dow == 5 else 0
    feat[:, col_map["is_sunday"]] = 1 if dow == 6 else 0
    feat[:, col_map["is_october"]] = 1 if month == 10 else 0
    feat[:, col_map["is_month_end"]] = 1 if fdate.is_month_end else 0
    feat[:, col_map["is_month_start"]] = 1 if dom == 1 else 0
    feat[:, col_map["trend"]] = trend
    feat[:, col_map["sin_month"]] = np.sin(2 * np.pi * month / 12)
    feat[:, col_map["cos_month"]] = np.cos(2 * np.pi * month / 12)
    feat[:, col_map["sin_dow"]] = np.sin(2 * np.pi * dow / 7)
    feat[:, col_map["cos_dow"]] = np.cos(2 * np.pi * dow / 7)

    feat[:, col_map["sku_mean"]] = lgbm_stats_df["sku_mean"].values
    feat[:, col_map["sku_std"]] = lgbm_stats_df["sku_std"].values
    feat[:, col_map["sku_median"]] = lgbm_stats_df["sku_median"].values
    feat[:, col_map["sku_max"]] = lgbm_stats_df["sku_max"].values
    feat[:, col_map["sku_p90"]] = lgbm_stats_df["sku_p90"].values
    feat[:, col_map["sku_active_rate"]] = lgbm_stats_df["sku_active_rate"].values

    for lag, cn in [
        (1, "lag_1"), (2, "lag_2"), (3, "lag_3"), (7, "lag_7"),
        (14, "lag_14"), (21, "lag_21"), (28, "lag_28"),
        (35, "lag_35"), (42, "lag_42"), (56, "lag_56"), (364, "lag_364"),
    ]:
        idx = row_idx - lag
        if idx >= 0:
            feat[:, col_map[cn]] = lgbm_ext[idx, :]

    for w, pfx in [(7, "7"), (14, "14"), (28, "28"), (56, "56")]:
        start = max(0, row_idx - w)
        win = lgbm_ext[start:row_idx, :]
        if len(win) > 0:
            feat[:, col_map[f"roll_mean_{pfx}"]] = win.mean(axis=0)
            feat[:, col_map[f"roll_std_{pfx}"]] = win.std(axis=0)
            feat[:, col_map[f"roll_max_{pfx}"]] = win.max(axis=0)
            feat[:, col_map[f"roll_median_{pfx}"]] = np.median(win, axis=0)

    if row_idx > 0:
        feat[:, col_map["expand_mean"]] = lgbm_ext[:row_idx, :].mean(axis=0)

    pred = model.predict(feat)
    pred = pred * magic_mult_arr

    # Tail: blend with DOW seasonal naive (last 56d mean)
    if tier_tail.any():
        naive_d = dow_naive[dow, :]
        pred[tier_tail] = (
            TAIL_BLEND_ALPHA * pred[tier_tail]
            + (1.0 - TAIL_BLEND_ALPHA) * naive_d[tier_tail]
        )

    # P90 cap (skip top tier)
    p90 = lgbm_stats_df["sku_p90"].values
    cap = p90 * P90_CAP_MULT
    pred = np.where(tier_top, pred, np.minimum(pred, cap))

    pred = np.clip(pred, 0, None)

    # Sunday hard-zero (EDA: 570 qty / 5 years)
    if dow == 6:
        pred[:] = 0.0

    lgbm_preds[day_idx, :] = pred
    lgbm_ext[row_idx, :] = pred
    current_streaks = np.where(pred > 0.5, 0, current_streaks + 1)

    if (day_idx + 1) % 14 == 0 or day_idx == 0:
        print(f"  Day {day_idx + 1:2d}/{HORIZON}  mean={pred.mean():.4f}")

preds_val = np.clip(lgbm_preds[:28, :].T, 0, None)
preds_eval = np.clip(lgbm_preds[28:, :].T, 0, None)

print("\n[6/7] WRMSSE report …")
if wrmsse_holdout is not None:
    print(f"  Holdout WRMSSE (aligned last 28d of train): {wrmsse_holdout:.6f}")
else:
    print("  Holdout WRMSSE: skipped (forecast-only mode)")

# ─── Save submission ──────────────────────────────────────────────────────────
print("\n[7/7] Saving submission V5 …")
val_df = pd.DataFrame(preds_val, columns=f_cols)
val_df.insert(0, "id", [f"{s}_validation" for s in sub_skus])
eval_df = pd.DataFrame(preds_eval, columns=f_cols)
eval_df.insert(0, "id", [f"{s}_evaluation" for s in sub_skus])

final_sub = pd.concat([val_df, eval_df], ignore_index=True)
final_sub = final_sub.set_index("id").reindex(sample_sub["id"].values).reset_index()

assert len(final_sub) == 31944
assert (final_sub[f_cols].values >= 0).all()

out_path = SUB_DIR / "submission_v5.csv"
final_sub.to_csv(out_path, index=False)
print(f"  Saved → {out_path}")
print(f"  Val  mean={preds_val.mean():.4f}  max={preds_val.max():.2f}")
print(f"  Eval mean={preds_eval.mean():.4f}  max={preds_eval.max():.2f}")
print("\nDone!")
