"""
Step 2: Data Preprocessing
===========================
• Aggregate raw transactions → daily net quantity per SKU
• Build full date × SKU grid (fill missing = 0)
• Clip daily qty: clip_lower=0 to avoid negative net (some days returns > sales)
• Compute per-SKU profit weight (for WRMSSE)
• Save preprocessed daily matrix + weight vector
"""

import pandas as pd
import numpy as np
from pathlib import Path

ROOT   = Path(__file__).parent.parent
DATA   = ROOT / "dataset"
PROC   = ROOT / "processed"
PROC.mkdir(exist_ok=True)

print("=" * 70)
print("HBAAC  |  Step 2: Preprocessing")
print("=" * 70)

# ─── 1. Load raw data ─────────────────────────────────────────────────────────
print("\n[1/6] Loading train.csv …")
train = pd.read_csv(DATA / "train.csv", dtype=str)
train["Date"]        = pd.to_datetime(train["Date"])
train["Quantity"]    = pd.to_numeric(train["Quantity"],    errors="coerce").fillna(0).astype(int)
train["SalesAmount"] = pd.to_numeric(train["SalesAmount"], errors="coerce").fillna(0)
train["Cost Amount"] = pd.to_numeric(train["Cost Amount"], errors="coerce").fillna(0)

print(f"  Loaded {len(train):,} rows, {train['ItemCode'].nunique():,} SKUs")

# ─── 2. Aggregate to daily net qty ────────────────────────────────────────────
print("\n[2/6] Aggregating to daily net quantity per SKU …")
# Strategy:
#   - Net qty per day = sum of all Quantity (positive=sales, negative=returns)
#   - We then CLIP lower bound to 0 so forecasts are non-negative
#   - BUT we keep negative values in the time-series for feature engineering accuracy
daily_net = (
    train
    .groupby(["Date", "ItemCode"])
    .agg(
        net_qty      = ("Quantity",    "sum"),
        sales_amount = ("SalesAmount", "sum"),
        cost_amount  = ("Cost Amount", "sum"),
    )
    .reset_index()
)
print(f"  Daily aggregated rows: {len(daily_net):,}")
print(f"  Rows with net_qty < 0 (returns > sales on that day): {(daily_net['net_qty'] < 0).sum():,}")

# ─── 3. Compute profit weight per SKU ─────────────────────────────────────────
print("\n[3/6] Computing SKU profit weights …")
sku_profit = (
    daily_net.groupby("ItemCode")
    .agg(
        total_sales = ("sales_amount", "sum"),
        total_cost  = ("cost_amount",  "sum"),
    )
    .assign(profit = lambda df: df["total_sales"] - df["total_cost"])
    .assign(profit_pos = lambda df: df["profit"].clip(lower=0))
)
total_profit_pos = sku_profit["profit_pos"].sum()
sku_profit["weight"] = sku_profit["profit_pos"] / total_profit_pos
sku_profit = sku_profit.reset_index()

# Compute WRMSSE denominator per SKU
print("\n[3b/6] Computing WRMSSE denominators per SKU …")
all_dates = pd.date_range(train["Date"].min(), train["Date"].max(), freq="D")
# Pivot to full matrix to easily compute diffs
pivot = daily_net.pivot_table(index="Date", columns="ItemCode", values="net_qty", fill_value=0)
pivot = pivot.reindex(all_dates, fill_value=0)

denom_dict = {}
for sku in sku_profit["ItemCode"]:
    if sku in pivot.columns:
        col = pivot[sku].values
        # WRMSSE denom is the mean squared first differences
        diffs = np.diff(col)
        denom = np.mean(diffs**2)
        if denom == 0:
            denom = 1e-8 # Prevent div by zero
        denom_dict[sku] = denom
    else:
        denom_dict[sku] = 1e-8

sku_profit["wrmsse_denom"] = sku_profit["ItemCode"].map(denom_dict)

print(f"  Total positive profit: {total_profit_pos:,.0f} VND")
print(f"  SKUs with weight  > 0: {(sku_profit['weight'] > 0).sum():,}")
print(f"  SKUs with weight == 0: {(sku_profit['weight'] == 0).sum():,}")
sku_profit.to_csv(PROC / "sku_weights.csv", index=False)
print(f"  Saved → processed/sku_weights.csv")

# ─── 4. Build full date × SKU panel ──────────────────────────────────────────
print("\n[4/6] Building full daily panel (date × SKU) …")
all_dates = pd.date_range(train["Date"].min(), train["Date"].max(), freq="D")
all_skus  = sorted(train["ItemCode"].unique())
print(f"  Dates: {len(all_dates)}  |  SKUs: {len(all_skus):,}")

# Create cartesian product index
idx = pd.MultiIndex.from_product([all_dates, all_skus], names=["Date", "ItemCode"])
panel = (
    pd.DataFrame(index=idx)
    .reset_index()
    .merge(daily_net[["Date", "ItemCode", "net_qty"]], on=["Date", "ItemCode"], how="left")
)
panel["net_qty"] = panel["net_qty"].fillna(0)

# Apply floor at 0 for training targets
# NOTE: we keep raw net_qty in separate column for feature purposes
panel["qty"] = panel["net_qty"].clip(lower=0)

print(f"  Panel shape: {panel.shape}")
print(f"  Non-zero rows: {(panel['qty'] > 0).sum():,}  ({100*(panel['qty'] > 0).mean():.2f}%)")
print(f"  Sparsity: {100*(panel['qty'] == 0).mean():.1f}%")

# ─── 5. Merge weights into panel ──────────────────────────────────────────────
print("\n[5/6] Merging weights …")
panel = panel.merge(sku_profit[["ItemCode", "weight", "profit", "wrmsse_denom"]], on="ItemCode", how="left")
panel["weight"] = panel["weight"].fillna(0)
panel["wrmsse_denom"] = panel["wrmsse_denom"].fillna(1e-8)

# ─── 6. Save ──────────────────────────────────────────────────────────────────
print("\n[6/6] Saving processed panel …")
# Save as parquet for efficiency (large file)
panel.to_parquet(PROC / "daily_panel.parquet", index=False, compression="zstd")
print(f"  Saved → processed/daily_panel.parquet ({panel.shape})")

# Also save SKU list for reference
pd.Series(all_skus, name="ItemCode").to_csv(PROC / "sku_list.csv", index=False)

# Print some stats about the final panel
print(f"\nFinal Panel Summary:")
print(f"  Shape         : {panel.shape}")
print(f"  Date range    : {panel['Date'].min().date()} → {panel['Date'].max().date()}")
print(f"  Unique SKUs   : {panel['ItemCode'].nunique():,}")
print(f"  Unique dates  : {panel['Date'].nunique():,}")
print(f"  Mean daily qty: {panel['qty'].mean():.4f}")
print(f"  Max daily qty : {panel['qty'].max():,}")
print(f"  Memory usage  : {panel.memory_usage(deep=True).sum() / 1e6:.1f} MB")

print("\nPreprocessing complete!")
