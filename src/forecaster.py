"""
Step 9: Grandmaster Model
=========================
Advanced optimizations for Kaggle-level WRMSSE forecasting:
1. Price Dynamics: Unit price features (fill-forward).
2. VN Holidays: Tết, 30/4, 1/5, 2/9.
3. Categorical ItemCode: Native LightGBM handling (Fixed categorical alignment).
4. Time-Decay Weights: Recent data weighted higher.
5. Zero-Streak: days_since_last_sale.
6. Magic Multiplier: Tames over-prediction of sparse counts.
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

ROOT  = Path(__file__).parent.parent
PROC  = ROOT / "processed"
DATA  = ROOT / "dataset"
MDIR  = ROOT / "models"
OUTD  = ROOT / "submissions"
MDIR.mkdir(exist_ok=True)

print("=" * 70)
print("HBAAC  |  Step 9: Grandmaster Model")
print("=" * 70)

# ─── Load data ────────────────────────────────────────────────────────────────
print("\n[1/6] Loading data …")
sample_sub  = pd.read_csv(DATA / "sample_submission.csv")
f_cols = [f"F{i}" for i in range(1, 29)]

sub_skus = sorted(
    sample_sub["id"].str.replace("_(validation|evaluation)$","",regex=True).unique()
)
TRAIN_END   = pd.Timestamp("2025-09-05")
VALID_START = pd.Timestamp("2025-09-06")

print(f"  Sub SKUs: {len(sub_skus):,}")

# Global SKU Categorical mapping to ensure train/inference alignment
sku_cat_dtype = pd.CategoricalDtype(categories=sub_skus, ordered=False)

# ─── Feature Engineering ──────────────────────────────────────────────────────
print("\n[2/6] Building Grandmaster Features …")

fp = pd.read_parquet(PROC / "feature_panel.parquet")
fp["Date"] = pd.to_datetime(fp["Date"])
fp = fp.sort_values(["ItemCode", "Date"]).reset_index(drop=True)

# 1. Price Dynamics
print("  - Computing Price Dynamics (Target Leak Safe) …")
fp["daily_price"] = np.where(fp["qty"] > 0, fp["sales_amount"] / fp["qty"], np.nan)
fp["last_known_price"] = fp.groupby("ItemCode")["daily_price"].ffill().fillna(0)
fp["price_lag1"] = fp.groupby("ItemCode")["last_known_price"].shift(1).astype(np.float32)
fp.drop(columns=["daily_price", "last_known_price"], inplace=True)

# 2. Categorical ItemCode (FIXED ALIGNMENT)
print("  - Encoding Categorical ItemCode …")
fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat_dtype).cat.codes

# 3. Time Decay Weight
print("  - Applying Time Decay to Sample Weights …")
days_diff = (fp["Date"] - TRAIN_END).dt.days
decay_factor = np.exp(days_diff / 730.0)
fp["decay_weight"] = np.clip(decay_factor, 0.1, 1.0)

# 4. Zero Streak
print("  - Computing Zero Streaks …")
is_sale = (fp["qty"] > 0).astype(int)
sale_blocks = is_sale.groupby(fp["ItemCode"]).cumsum()
fp["days_since_last_sale"] = fp.groupby(["ItemCode", sale_blocks]).cumcount().astype(np.float32)
fp["days_since_last_sale_lag1"] = fp.groupby("ItemCode")["days_since_last_sale"].shift(1).fillna(0).astype(np.float32)
fp.drop(columns=["days_since_last_sale"], inplace=True)

# 5. Vietnamese Holidays & Sunday Phenomenon
print("  - Adding VN Holidays & DOW features …")
# We add both is_weekend and is_sunday so the model has maximum flexibility
fp["is_sunday"] = (fp["Date"].dt.dayofweek == 6).astype(np.int8)
fp["is_weekend"] = (fp["Date"].dt.dayofweek >= 5).astype(np.int8)

tet_dates = pd.to_datetime(["2021-02-12", "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29"])
other_holidays = []
for y in range(2020, 2026):
    other_holidays.extend([f"{y}-01-01", f"{y}-04-30", f"{y}-05-01", f"{y}-09-02"])
other_dates = pd.to_datetime(other_holidays)
all_holidays = pd.Index(tet_dates.tolist() + other_dates.tolist())

fp["is_holiday"] = fp["Date"].isin(all_holidays).astype(np.int8)

unique_dates = pd.Series(fp["Date"].unique()).sort_values()
days_to_hol = []
for d in unique_dates:
    future_hols = all_holidays[all_holidays >= d]
    if len(future_hols) > 0:
        days_to_hol.append((future_hols.min() - d).days)
    else:
        days_to_hol.append(999)
date_to_hol_map = dict(zip(unique_dates, days_to_hol))
fp["days_to_next_holiday"] = fp["Date"].map(date_to_hol_map).astype(np.int16)


# ─── Training ─────────────────────────────────────────────────────────────────
print("\n[3/6] Training Grandmaster LGBM …")

FEAT_COLS = [
    "ItemCode_cat",
    "price_lag1",
    "days_since_last_sale_lag1",
    "is_holiday", "days_to_next_holiday",
    
    "dayofweek","dayofmonth","month","quarter","dayofyear","weekofyear",
    "year","is_weekend","is_sunday","is_month_end","is_month_start","trend",
    "sin_month","cos_month","sin_dow","cos_dow",
    "sku_mean","sku_std","sku_median","sku_max","sku_p90","sku_active_rate",
    "lag_1","lag_2","lag_3","lag_7","lag_14","lag_21","lag_28",
    "lag_35","lag_42","lag_56",
    "roll_mean_7","roll_std_7","roll_max_7","roll_median_7",
    "roll_mean_14","roll_std_14","roll_max_14","roll_median_14",
    "roll_mean_28","roll_std_28","roll_max_28","roll_median_28",
    "roll_mean_56","roll_std_56","roll_max_56","roll_median_56",
    "expand_mean",
]

VAL_START = TRAIN_END - pd.Timedelta(days=55)
mask_train = fp["Date"] <  VAL_START
mask_val   = fp["Date"] >= VAL_START

X_train = fp.loc[mask_train, FEAT_COLS]
y_train = fp.loc[mask_train, "qty"]
wrmsse_w_train = (fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])).values
w_train = wrmsse_w_train * fp.loc[mask_train, "decay_weight"].values

X_val   = fp.loc[mask_val, FEAT_COLS]
y_val   = fp.loc[mask_val, "qty"]
w_val   = (fp.loc[mask_val, "weight"] / np.sqrt(fp.loc[mask_val, "wrmsse_denom"])).values

print(f"  Train rows: {X_train.shape[0]:,}  Val rows: {X_val.shape[0]:,}")

dtrain = lgb.Dataset(X_train, label=y_train, weight=w_train,
                     categorical_feature=["ItemCode_cat"],
                     feature_name=FEAT_COLS, free_raw_data=True)
dval   = lgb.Dataset(X_val,   label=y_val,   weight=w_val,
                     categorical_feature=["ItemCode_cat"],
                     reference=dtrain, free_raw_data=True)

params_v4 = {
    "objective":        "tweedie",
    "tweedie_variance_power": 1.25, # A bit lower to respect variance of high counts
    "metric":           "rmse",
    "learning_rate":    0.05,
    "num_leaves":       255,
    "max_depth":        10,
    "min_data_in_leaf": 100,
    "feature_fraction": 0.7,
    "bagging_fraction": 0.8,
    "bagging_freq":     1,
    "lambda_l1":        0.1,
    "lambda_l2":        0.1,
    "verbose":          -1,
    "n_jobs":           -1,
    "seed":             42,
}

evals_v4 = {}
model_v4 = lgb.train(
    params           = params_v4,
    train_set        = dtrain,
    num_boost_round  = 3000,
    valid_sets       = [dval],
    valid_names      = ["val"],
    callbacks        = [
        lgb.early_stopping(150, verbose=True),
        lgb.log_evaluation(100),
        lgb.record_evaluation(evals_v4),
    ],
)
model_v4.save_model(str(MDIR / "lgbm_v4_grandmaster.txt"))
best_v4 = model_v4.best_iteration
print(f"  Model V4 best_iter={best_v4}")

# ─── Recursive forecast for ALL SKUs ─────────────────────────────────────
print("\n[4/6] Recursive forecast (Grandmaster) …")

train_raw = pd.read_csv(DATA / "train.csv", dtype=str)
train_raw["Date"]     = pd.to_datetime(train_raw["Date"])
train_raw["Quantity"] = pd.to_numeric(train_raw["Quantity"], errors="coerce").fillna(0).astype(int)
train_raw["SalesAmount"] = pd.to_numeric(train_raw["SalesAmount"], errors="coerce").fillna(0)

daily_net = (
    train_raw.groupby(["Date","ItemCode"])
    .agg(qty=("Quantity", "sum"), sales=("SalesAmount", "sum"))
    .reset_index()
)
daily_net["qty"] = daily_net["qty"].clip(lower=0)

daily_qty = daily_net.pivot_table(index="Date", columns="ItemCode", values="qty", fill_value=0)
daily_sales = daily_net.pivot_table(index="Date", columns="ItemCode", values="sales", fill_value=0)

all_dates = pd.date_range(daily_qty.index.min(), daily_qty.index.max(), freq="D")
daily_qty = daily_qty.reindex(all_dates, fill_value=0)
daily_sales = daily_sales.reindex(all_dates, fill_value=0)

missing_skus = [s for s in sub_skus if s not in daily_qty.columns]
if missing_skus: 
    daily_qty[missing_skus] = 0
    daily_sales[missing_skus] = 0
daily_qty = daily_qty[sub_skus]
daily_sales = daily_sales[sub_skus]

lgbm_hist = daily_qty.values.astype(np.float32)
n_hist = len(lgbm_hist)
lgbm_pad = np.zeros((56, len(sub_skus)), dtype=np.float32)
lgbm_ext = np.vstack([lgbm_hist, lgbm_pad])

forecast_dates = pd.date_range(VALID_START, periods=56, freq="D")
t0 = pd.Timestamp("2020-11-17")

# Precompute stats
lgbm_stats_df = pd.DataFrame(index=sub_skus)
last_known_prices = []
current_streaks = []

for sku in sub_skus:
    col = daily_qty[sku]
    nz = col[col > 0]
    lgbm_stats_df.loc[sku, "sku_mean"]        = float(col.mean())
    lgbm_stats_df.loc[sku, "sku_std"]         = float(col.std()) if col.std() > 0 else 0
    lgbm_stats_df.loc[sku, "sku_median"]      = float(col.median())
    lgbm_stats_df.loc[sku, "sku_max"]         = float(col.max())
    lgbm_stats_df.loc[sku, "sku_p90"]         = float(nz.quantile(0.9)) if len(nz) > 0 else 0
    lgbm_stats_df.loc[sku, "sku_active_rate"] = float((col > 0).mean())
    
    # Last known price
    sales_col = daily_sales[sku]
    prices = np.where(col > 0, sales_col / col, np.nan)
    s_prices = pd.Series(prices).ffill().fillna(0).values
    last_known_prices.append(s_prices[-1])
    
    # Current streak
    if len(nz) == 0:
        current_streaks.append(len(col))
    else:
        last_active_idx = col.to_numpy().nonzero()[0][-1]
        current_streaks.append(len(col) - 1 - last_active_idx)

last_known_prices = np.array(last_known_prices, dtype=np.float32)
current_streaks   = np.array(current_streaks, dtype=np.float32)

lgbm_preds = np.zeros((56, len(sub_skus)), dtype=np.float32)
col_map = {c: i for i, c in enumerate(FEAT_COLS)}

# FIXED ALIGNMENT
cat_codes = pd.Series(sub_skus).astype(sku_cat_dtype).cat.codes.values

for day_idx, fdate in enumerate(forecast_dates):
    row_idx = n_hist + day_idx
    n = len(sub_skus)
    feat = np.zeros((n, len(FEAT_COLS)), dtype=np.float32)

    dow, dom, month, qtr = fdate.dayofweek, fdate.day, fdate.month, fdate.quarter
    doy, woy, year       = fdate.dayofyear, fdate.isocalendar()[1], fdate.year
    trend = (fdate - t0).days

    feat[:, col_map["ItemCode_cat"]] = cat_codes
    feat[:, col_map["price_lag1"]]   = last_known_prices
    feat[:, col_map["days_since_last_sale_lag1"]] = current_streaks
    
    feat[:, col_map["is_holiday"]] = 1 if fdate in all_holidays else 0
    fut_hols = all_holidays[all_holidays >= fdate]
    feat[:, col_map["days_to_next_holiday"]] = (fut_hols.min() - fdate).days if len(fut_hols) > 0 else 999

    feat[:, col_map["dayofweek"]]    = dow
    feat[:, col_map["dayofmonth"]]   = dom
    feat[:, col_map["month"]]        = month
    feat[:, col_map["quarter"]]      = qtr
    feat[:, col_map["dayofyear"]]    = doy
    feat[:, col_map["weekofyear"]]   = woy
    feat[:, col_map["year"]]         = year
    feat[:, col_map["is_weekend"]]   = 1 if dow >= 5 else 0
    feat[:, col_map["is_sunday"]]    = 1 if dow == 6 else 0
    feat[:, col_map["is_month_end"]] = 1 if fdate == fdate + pd.offsets.MonthEnd(0) else 0
    feat[:, col_map["is_month_start"]] = 1 if dom == 1 else 0
    feat[:, col_map["trend"]]        = trend
    feat[:, col_map["sin_month"]]    = np.sin(2*np.pi*month/12)
    feat[:, col_map["cos_month"]]    = np.cos(2*np.pi*month/12)
    feat[:, col_map["sin_dow"]]      = np.sin(2*np.pi*dow/7)
    feat[:, col_map["cos_dow"]]      = np.cos(2*np.pi*dow/7)

    feat[:, col_map["sku_mean"]]        = lgbm_stats_df["sku_mean"].values
    feat[:, col_map["sku_std"]]         = lgbm_stats_df["sku_std"].values
    feat[:, col_map["sku_median"]]      = lgbm_stats_df["sku_median"].values
    feat[:, col_map["sku_max"]]         = lgbm_stats_df["sku_max"].values
    feat[:, col_map["sku_p90"]]         = lgbm_stats_df["sku_p90"].values
    feat[:, col_map["sku_active_rate"]] = lgbm_stats_df["sku_active_rate"].values

    for lag, cn in [(1,"lag_1"),(2,"lag_2"),(3,"lag_3"),(7,"lag_7"),
                    (14,"lag_14"),(21,"lag_21"),(28,"lag_28"),
                    (35,"lag_35"),(42,"lag_42"),(56,"lag_56")]:
        idx = row_idx - lag
        if idx >= 0:
            feat[:, col_map[cn]] = lgbm_ext[idx, :]

    for w, pfx in [(7,"7"),(14,"14"),(28,"28"),(56,"56")]:
        start = max(0, row_idx - w)
        win   = lgbm_ext[start:row_idx, :]
        if len(win) > 0:
            feat[:, col_map[f"roll_mean_{pfx}"]]   = win.mean(axis=0)
            feat[:, col_map[f"roll_std_{pfx}"]]    = win.std(axis=0)
            feat[:, col_map[f"roll_max_{pfx}"]]    = win.max(axis=0)
            feat[:, col_map[f"roll_median_{pfx}"]] = np.median(win, axis=0)

    if row_idx > 0:
        feat[:, col_map["expand_mean"]] = lgbm_ext[:row_idx, :].mean(axis=0)

    pred = model_v4.predict(feat)
    
    # MAGIC MULTIPLIER: Scale down slightly to optimize for high sparsity
    MAGIC_MULT = 0.96 
    pred_clipped = np.clip(pred * MAGIC_MULT, 0, None)
    
    lgbm_preds[day_idx, :]  = pred_clipped
    lgbm_ext[row_idx, :]    = pred_clipped
    
    # Update streak
    current_streaks = np.where(pred_clipped > 0.5, 0, current_streaks + 1)

    if (day_idx + 1) % 14 == 0 or day_idx == 0:
        print(f"  Day {day_idx+1:2d}/56  mean={pred_clipped.mean():.4f}")

preds_val  = np.clip(lgbm_preds[:28, :].T, 0, None)
preds_eval = np.clip(lgbm_preds[28:, :].T, 0, None)

# ─── 5. Back-test WRMSSE ──────────────────────────────────────────────────────
print("\n[5/6] Back-test pseudo-WRMSSE …")
sku_weights = pd.read_csv(PROC / "sku_weights.csv").set_index("ItemCode")
PSEUDO_VAL_START = pd.Timestamp("2025-08-09")

wrmsse_v4 = 0.0
for i, sku in enumerate(sub_skus):
    w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0.0
    denom = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
    if w <= 0 or sku not in daily_qty.columns: continue
    col    = daily_qty[sku]
    y_va   = col[(col.index >= PSEUDO_VAL_START) & (col.index <= TRAIN_END)].values[:28]
    if len(y_va) == 0: continue
    
    y_p = preds_val[i, :len(y_va)]
    rmse = np.sqrt(np.mean((y_va - y_p)**2))
    wrmsse_v4 += w * (rmse / np.sqrt(denom))

print(f"  V4 pseudo-WRMSSE (Grandmaster): {wrmsse_v4:.6f}")

# ─── 6. Save final V4 submission ─────────────────────────────────────────────
print("\n[6/6] Saving final V4 submission …")

val_df  = pd.DataFrame(preds_val,  columns=f_cols)
val_df.insert(0, "id", [f"{s}_validation" for s in sub_skus])
eval_df = pd.DataFrame(preds_eval, columns=f_cols)
eval_df.insert(0, "id", [f"{s}_evaluation" for s in sub_skus])

final_sub_v4 = pd.concat([val_df, eval_df], ignore_index=True)
final_sub_v4 = final_sub_v4.set_index("id").reindex(sample_sub["id"].values).reset_index()

assert len(final_sub_v4) == 31944
assert (final_sub_v4[f_cols].values >= 0).all()

out_path = OUTD / "submission_v4_grandmaster.csv"
final_sub_v4.to_csv(out_path, index=False)
print(f"  ✓ Saved → {out_path}")
print(f"  Rows: {len(final_sub_v4):,}")
print(f"  Val  preds: min={preds_val.min():.4f}  max={preds_val.max():.2f}  mean={preds_val.mean():.4f}")
print(f"  Eval preds: min={preds_eval.min():.4f}  max={preds_eval.max():.2f}  mean={preds_eval.mean():.4f}")
print(f"\n  🎯 Submit: submissions/submission_v4_grandmaster.csv")
print("Done!")
