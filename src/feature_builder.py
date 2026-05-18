"""
Step 3: Feature Engineering (Memory-Efficient Version)
=======================================================
Key insight: ~98% zeros → we only need feature rows where SKU was EVER active.
Strategy:
  1. Filter panel to "active SKUs" (had any sales in training)
  2. For active SKUs, keep only their actual active date range (first_sale..last_date)
  3. This reduces rows from 28M → ~2M manageable rows
  4. For zero-weight / inactive SKUs → predict 0 (handled at forecast step)
"""

import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).parent.parent
PROC = ROOT / "processed"
PROC.mkdir(exist_ok=True)

print("=" * 70)
print("HBAAC  |  Step 3: Feature Engineering (Memory-Efficient)")
print("=" * 70)

# ─── 1. Load raw aggregated data (not full panel) ─────────────────────────────
print("\n[1/7] Loading data …")

def parse_vn_number(s):
    if pd.isna(s): return np.nan
    s = str(s).strip().replace(" ", "")
    if s.count(",") == 1 and s.index(",") >= len(s) - 5:
        s = s.replace(",", ".")
    else:
        s = s.replace(",", "")
    try: return float(s)
    except: return np.nan

train = pd.read_csv(ROOT / "dataset" / "train.csv", dtype=str)
train["Date"]        = pd.to_datetime(train["Date"])
train["Quantity"]    = pd.to_numeric(train["Quantity"],    errors="coerce").fillna(0).astype(int)
train["SalesAmount"] = pd.to_numeric(train["SalesAmount"], errors="coerce").fillna(0)
train["Cost Amount"] = pd.to_numeric(train["Cost Amount"], errors="coerce").fillna(0)

print(f"  Loaded {len(train):,} rows, {train['ItemCode'].nunique():,} SKUs")

# ─── 2. Daily net qty aggregation ────────────────────────────────────────────
print("\n[2/7] Aggregating daily net qty …")
daily_net = (
    train.groupby(["Date", "ItemCode"])
    .agg(
        net_qty      = ("Quantity",    "sum"),
        sales_amount = ("SalesAmount", "sum"),
        cost_amount  = ("Cost Amount", "sum"),
    )
    .reset_index()
)
daily_net["qty"] = daily_net["net_qty"].clip(lower=0)

# ─── 3. Load profit weights ───────────────────────────────────────────────────────
print("\n[3/7] Loading profit weights …")
sku_profit = pd.read_csv(PROC / "sku_weights.csv")

# ─── 4. Build panel only for ACTIVE SKUs ─────────────────────────────────────
print("\n[4/7] Building panel for active SKUs only …")
# Active = had at least 1 positive sale
active_skus = daily_net.loc[daily_net["qty"] > 0, "ItemCode"].unique()
print(f"  Active SKUs: {len(active_skus):,}  (inactive will be predicted as 0)")

# For each active SKU, date range from its FIRST ever sale to train end
sku_first_sale = daily_net[daily_net["qty"] > 0].groupby("ItemCode")["Date"].min().reset_index()
sku_first_sale.columns = ["ItemCode", "first_sale"]

TRAIN_END = pd.Timestamp("2025-09-05")
all_dates  = pd.date_range("2020-11-17", TRAIN_END, freq="D")

# Build panel per active SKU
panels = []
for sku in active_skus:
    first_d = sku_first_sale.loc[sku_first_sale["ItemCode"] == sku, "first_sale"].values[0]
    # Start 56 days before first sale to allow lag features to warm up
    start_d = max(pd.Timestamp("2020-11-17"), pd.Timestamp(first_d) - pd.Timedelta(days=56))
    dates = pd.date_range(start_d, TRAIN_END, freq="D")
    df = pd.DataFrame({"Date": dates, "ItemCode": sku})
    panels.append(df)

print(f"  Building panel rows …")
panel = pd.concat(panels, ignore_index=True)
print(f"  Panel shape before merge: {panel.shape}")

# Merge actual sales
panel = panel.merge(daily_net[["Date","ItemCode","qty","net_qty","sales_amount","cost_amount"]],
                    on=["Date","ItemCode"], how="left")
panel["qty"]          = panel["qty"].fillna(0)
panel["net_qty"]      = panel["net_qty"].fillna(0)
panel["sales_amount"] = panel["sales_amount"].fillna(0)
panel["cost_amount"]  = panel["cost_amount"].fillna(0)

# Merge weights
panel = panel.merge(sku_profit[["ItemCode","weight","profit", "wrmsse_denom"]], on="ItemCode", how="left")
panel["weight"] = panel["weight"].fillna(0)
panel["wrmsse_denom"] = panel["wrmsse_denom"].fillna(1e-8)
panel = panel.sort_values(["ItemCode","Date"]).reset_index(drop=True)
print(f"  Panel shape after merge: {panel.shape}")

# ─── 5. Feature engineering ──────────────────────────────────────────────────
print("\n[5/7] Adding features …")

# Calendar
panel["dayofweek"]   = panel["Date"].dt.dayofweek.astype(np.int8)
panel["dayofmonth"]  = panel["Date"].dt.day.astype(np.int8)
panel["month"]       = panel["Date"].dt.month.astype(np.int8)
panel["quarter"]     = panel["Date"].dt.quarter.astype(np.int8)
panel["dayofyear"]   = panel["Date"].dt.dayofyear.astype(np.int16)
panel["weekofyear"]  = panel["Date"].dt.isocalendar().week.astype(np.int8)
panel["year"]        = panel["Date"].dt.year.astype(np.int16)
panel["is_weekend"]  = (panel["dayofweek"] >= 5).astype(np.int8)
panel["is_month_end"]   = panel["Date"].dt.is_month_end.astype(np.int8)
panel["is_month_start"] = panel["Date"].dt.is_month_start.astype(np.int8)
panel["trend"]       = (panel["Date"] - panel["Date"].min()).dt.days.astype(np.int16)
panel["sin_month"]   = np.sin(2 * np.pi * panel["month"] / 12).astype(np.float32)
panel["cos_month"]   = np.cos(2 * np.pi * panel["month"] / 12).astype(np.float32)
panel["sin_dow"]     = np.sin(2 * np.pi * panel["dayofweek"] / 7).astype(np.float32)
panel["cos_dow"]     = np.cos(2 * np.pi * panel["dayofweek"] / 7).astype(np.float32)

# SKU-level stats (properly computed over full available history)
# We calculate total_active_days and total_days to get correct active_rate
sku_stats = (
    daily_net.groupby("ItemCode")["qty"]
    .agg(sku_mean="mean", 
         sku_std="std", 
         sku_median="median",
         sku_max="max", 
         sku_active_rate=lambda x: (x > 0).mean())
    .reset_index()
)

# For sku_p90, we only want the 90th percentile of NON-ZERO days
sku_p90 = (
    daily_net[daily_net["qty"] > 0].groupby("ItemCode")["qty"]
    .quantile(0.9)
    .reset_index()
    .rename(columns={"qty": "sku_p90"})
)

sku_stats = sku_stats.merge(sku_p90, on="ItemCode", how="left").fillna({"sku_p90": 0})

panel = panel.merge(sku_stats, on="ItemCode", how="left").fillna({
    "sku_mean":0, "sku_std":0, "sku_median":0, "sku_max":0, "sku_p90":0, "sku_active_rate":0
})

for c in ["sku_mean","sku_std","sku_median","sku_max","sku_p90","sku_active_rate"]:
    panel[c] = panel[c].astype(np.float32)

# Lag features
g = panel.groupby("ItemCode")["qty"]
for lag in [1, 2, 3, 7, 14, 21, 28, 35, 42, 56]:
    panel[f"lag_{lag}"] = g.shift(lag).astype(np.float32)

# Rolling features
for w in [7, 14, 28, 56]:
    shifted = g.shift(1)
    rolled  = shifted.rolling(w, min_periods=1)
    panel[f"roll_mean_{w}"]    = rolled.mean().astype(np.float32)
    panel[f"roll_std_{w}"]     = rolled.std().fillna(0).astype(np.float32)
    panel[f"roll_max_{w}"]     = rolled.max().astype(np.float32)
    panel[f"roll_median_{w}"]  = rolled.median().astype(np.float32)

# Expanding mean (long-term trend per SKU)
panel["expand_mean"] = g.shift(1).expanding(1).mean().astype(np.float32)

print(f"  Features added. Panel shape: {panel.shape}")

# ─── 6. Filter: keep only rows with lag_7 available ──────────────────────────
print("\n[6/7] Filtering training rows (lag_7 must exist) …")
train_panel = panel.dropna(subset=["lag_7"]).copy()
lag_like_cols = [c for c in train_panel.columns
                 if c.startswith("lag_") or c.startswith("roll_") or c.startswith("expand_")]
train_panel[lag_like_cols] = train_panel[lag_like_cols].fillna(0)
print(f"  Training rows: {len(train_panel):,}")

# ─── 7. Save ─────────────────────────────────────────────────────────────────
print("\n[7/7] Saving …")
train_panel.to_parquet(PROC / "feature_panel.parquet", index=False, compression="zstd")
print(f"  Saved → processed/feature_panel.parquet  {train_panel.shape}")

# Print feature list
feat_cols = [c for c in train_panel.columns
             if c not in ["Date","ItemCode","net_qty","qty","profit","weight",
                          "sales_amount","cost_amount"]]
print(f"\n  Total features: {len(feat_cols)}")
print(f"  Feature names: {feat_cols}")
print(f"\n  Memory: {train_panel.memory_usage(deep=True).sum()/1e6:.1f} MB")
print("\nFeature engineering complete!")
