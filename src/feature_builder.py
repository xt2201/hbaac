"""
Step 3: Feature Engineering (V5 — EDA-driven)
"""

import pandas as pd
import numpy as np

from config import DATA_DIR, PROC_DIR, DATA_START, TRAIN_START, TRAIN_END, VAL_DAYS

print("=" * 70)
print("HBAAC  |  Step 3: Feature Engineering (V5)")
print("=" * 70)

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
TRAIN_START_TS = pd.Timestamp(TRAIN_START)
DATA_START_TS = pd.Timestamp(DATA_START)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)

# ─── 1. Load raw data ─────────────────────────────────────────────────────────
print("\n[1/8] Loading data …")
train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0).astype(int)
train["SalesAmount"] = pd.to_numeric(train["SalesAmount"], errors="coerce").fillna(0)
train["Cost Amount"] = pd.to_numeric(train["Cost Amount"], errors="coerce").fillna(0)
print(f"  Loaded {len(train):,} rows, {train['ItemCode'].nunique():,} SKUs")

# ─── 2. Daily aggregation ─────────────────────────────────────────────────────
print("\n[2/8] Aggregating daily net qty …")
daily_net = (
    train.groupby(["Date", "ItemCode"])
    .agg(
        net_qty=("Quantity", "sum"),
        sales_amount=("SalesAmount", "sum"),
        cost_amount=("Cost Amount", "sum"),
        return_qty=("Quantity", lambda x: x[x < 0].sum()),  # negative sum
        txn_count=("Quantity", "count"),
    )
    .reset_index()
)
daily_net["return_qty"] = daily_net["return_qty"].abs()
daily_net["qty"] = daily_net["net_qty"].clip(lower=0)

# ─── 3. Load profit weights ───────────────────────────────────────────────────
print("\n[3/8] Loading profit weights …")
sku_profit = pd.read_csv(PROC_DIR / "sku_weights.csv")

# SKU stats: training cutoff (no leakage into LGBM val period)
print("\n[4/8] SKU stats (cutoff before val period) …")
stats_cutoff = daily_net[daily_net["Date"] < VAL_START_TS]
sku_stats = (
    stats_cutoff.groupby("ItemCode")["qty"]
    .agg(
        sku_mean="mean",
        sku_std="std",
        sku_median="median",
        sku_max="max",
        sku_active_rate=lambda x: (x > 0).mean(),
    )
    .reset_index()
)
sku_p90 = (
    stats_cutoff[stats_cutoff["qty"] > 0]
    .groupby("ItemCode")["qty"]
    .quantile(0.9)
    .reset_index()
    .rename(columns={"qty": "sku_p90"})
)
sku_stats = sku_stats.merge(sku_p90, on="ItemCode", how="left").fillna({"sku_p90": 0})

txn_per_sku = train.groupby("ItemCode").size().reset_index(name="txn_count_total")
txn_per_sku["txn_count_log"] = np.log1p(txn_per_sku["txn_count_total"]).astype(np.float32)
sku_stats = sku_stats.merge(txn_per_sku[["ItemCode", "txn_count_log"]], on="ItemCode", how="left")
sku_stats["txn_count_log"] = sku_stats["txn_count_log"].fillna(0).astype(np.float32)

# ─── 5. Build panel for active SKUs ─────────────────────────────────────────
print("\n[5/8] Building panel for active SKUs …")
active_skus = daily_net.loc[daily_net["qty"] > 0, "ItemCode"].unique()
print(f"  Active SKUs: {len(active_skus):,}")

sku_first_sale = (
    daily_net[daily_net["qty"] > 0].groupby("ItemCode")["Date"].min().reset_index()
)
sku_first_sale.columns = ["ItemCode", "first_sale"]

panels = []
for sku in active_skus:
    first_d = sku_first_sale.loc[sku_first_sale["ItemCode"] == sku, "first_sale"].values[0]
    start_d = max(DATA_START_TS, TRAIN_START_TS, pd.Timestamp(first_d) - pd.Timedelta(days=400))
    dates = pd.date_range(start_d, TRAIN_END_TS, freq="D")
    panels.append(pd.DataFrame({"Date": dates, "ItemCode": sku}))

panel = pd.concat(panels, ignore_index=True)
panel = panel.merge(
    daily_net[
        ["Date", "ItemCode", "qty", "net_qty", "sales_amount", "cost_amount", "return_qty"]
    ],
    on=["Date", "ItemCode"],
    how="left",
)
for c in ["qty", "net_qty", "sales_amount", "cost_amount", "return_qty"]:
    panel[c] = panel[c].fillna(0)

panel = panel.merge(sku_profit[["ItemCode", "weight", "profit", "wrmsse_denom"]], on="ItemCode", how="left")
panel["weight"] = panel["weight"].fillna(0)
panel["wrmsse_denom"] = panel["wrmsse_denom"].fillna(1e-8)
panel = panel.sort_values(["ItemCode", "Date"]).reset_index(drop=True)

# ─── 6. Calendar & EDA features ───────────────────────────────────────────────
print("\n[6/8] Adding calendar & EDA features …")
panel["dayofweek"] = panel["Date"].dt.dayofweek.astype(np.int8)
panel["dayofmonth"] = panel["Date"].dt.day.astype(np.int8)
panel["month"] = panel["Date"].dt.month.astype(np.int8)
panel["quarter"] = panel["Date"].dt.quarter.astype(np.int8)
panel["dayofyear"] = panel["Date"].dt.dayofyear.astype(np.int16)
panel["weekofyear"] = panel["Date"].dt.isocalendar().week.astype(np.int8)
panel["year"] = panel["Date"].dt.year.astype(np.int16)
panel["is_saturday"] = (panel["dayofweek"] == 5).astype(np.int8)
panel["is_sunday"] = (panel["dayofweek"] == 6).astype(np.int8)
panel["is_weekend"] = (panel["dayofweek"] >= 5).astype(np.int8)
panel["is_october"] = (panel["month"] == 10).astype(np.int8)
panel["is_month_end"] = panel["Date"].dt.is_month_end.astype(np.int8)
panel["is_month_start"] = panel["Date"].dt.is_month_start.astype(np.int8)
panel["trend"] = (panel["Date"] - DATA_START_TS).dt.days.astype(np.int16)
panel["sin_month"] = np.sin(2 * np.pi * panel["month"] / 12).astype(np.float32)
panel["cos_month"] = np.cos(2 * np.pi * panel["month"] / 12).astype(np.float32)
panel["sin_dow"] = np.sin(2 * np.pi * panel["dayofweek"] / 7).astype(np.float32)
panel["cos_dow"] = np.cos(2 * np.pi * panel["dayofweek"] / 7).astype(np.float32)

panel = panel.merge(sku_stats, on="ItemCode", how="left").fillna(
    {
        "sku_mean": 0,
        "sku_std": 0,
        "sku_median": 0,
        "sku_max": 0,
        "sku_p90": 0,
        "sku_active_rate": 0,
        "txn_count_log": 0,
    }
)
for c in ["sku_mean", "sku_std", "sku_median", "sku_max", "sku_p90", "sku_active_rate"]:
    panel[c] = panel[c].astype(np.float32)

# Return rate rolling (per SKU)
g_ret = panel.groupby("ItemCode")
panel["return_rate_28d"] = (
    g_ret["return_qty"]
    .transform(lambda x: x.shift(1).rolling(28, min_periods=1).sum())
    / (g_ret["qty"].transform(lambda x: x.shift(1).rolling(28, min_periods=1).sum()) + 1e-6)
).astype(np.float32)
panel["return_rate_28d"] = panel["return_rate_28d"].clip(0, 1).fillna(0)

# Lag / rolling / YoY
g = panel.groupby("ItemCode")["qty"]
for lag in [1, 2, 3, 7, 14, 21, 28, 35, 42, 56, 364]:
    panel[f"lag_{lag}"] = g.shift(lag).astype(np.float32)

for w in [7, 14, 28, 56]:
    shifted = g.shift(1)
    rolled = shifted.rolling(w, min_periods=1)
    panel[f"roll_mean_{w}"] = rolled.mean().astype(np.float32)
    panel[f"roll_std_{w}"] = rolled.std().fillna(0).astype(np.float32)
    panel[f"roll_max_{w}"] = rolled.max().astype(np.float32)
    panel[f"roll_median_{w}"] = rolled.median().astype(np.float32)

panel["expand_mean"] = g.shift(1).expanding(1).mean().astype(np.float32)

# ─── 7. Filter training rows ──────────────────────────────────────────────────
print("\n[7/8] Filtering training rows …")
train_panel = panel[(panel["Date"] >= TRAIN_START_TS) & panel["lag_7"].notna()].copy()
lag_like_cols = [
    c
    for c in train_panel.columns
    if c.startswith("lag_") or c.startswith("roll_") or c == "expand_mean"
]
train_panel[lag_like_cols] = train_panel[lag_like_cols].fillna(0)
print(f"  Training rows: {len(train_panel):,}  (from {TRAIN_START})")

# ─── 8. Save ──────────────────────────────────────────────────────────────────
print("\n[8/8] Saving …")
train_panel.to_parquet(PROC_DIR / "feature_panel.parquet", index=False, compression="zstd")
sku_stats.to_csv(PROC_DIR / "sku_stats.csv", index=False)
print(f"  Saved → processed/feature_panel.parquet  {train_panel.shape}")
print(f"  Saved → processed/sku_stats.csv")
print("\nFeature engineering complete!")
