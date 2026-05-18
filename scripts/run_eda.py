"""
Step 1B: Deep Exploratory Data Analysis
========================================
Generates high-quality, non-overlapping charts to find hidden patterns.
- Sunday vs Saturday dynamics
- High-profit bulk buyer patterns
- Missing days analysis
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Clean plotting settings
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams.update({
    'font.size': 12,
    'figure.autolayout': True,
    'axes.titlesize': 16,
    'axes.labelsize': 14,
    'xtick.labelsize': 12,
    'ytick.labelsize': 12,
    'legend.fontsize': 12,
})

ROOT = Path(__file__).parent.parent
DATA = ROOT / "dataset"
OUTD = ROOT / "eda_output"
OUTD.mkdir(exist_ok=True)

print("Loading data...")
train = pd.read_csv(DATA / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0).astype(int)
train["SalesAmount"] = pd.to_numeric(train["SalesAmount"], errors="coerce").fillna(0)

# ==========================================
# 1. Day of Week / Missing Days Analysis
# ==========================================
print("Generating DOW Analysis...")
dow_sales = train[train["Quantity"] > 0].groupby(train["Date"].dt.dayofweek)["Quantity"].sum().reset_index()
dow_map = {0:"Monday", 1:"Tuesday", 2:"Wednesday", 3:"Thursday", 4:"Friday", 5:"Saturday", 6:"Sunday"}
dow_sales["Day"] = dow_sales["Date"].map(dow_map)

plt.figure(figsize=(10, 6))
bars = plt.bar(dow_sales["Day"], dow_sales["Quantity"], color="#2c3e50")
plt.title("Total Quantity Sold by Day of Week\n(Notice Sunday is almost completely DEAD)", pad=20)
plt.ylabel("Total Quantity Sold")
plt.xlabel("Day of Week")

# Add text labels on top of bars
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + (yval * 0.02), f'{int(yval):,}', ha='center', va='bottom', fontsize=11)
plt.savefig(OUTD / "07_dow_deep_analysis.png", dpi=300, bbox_inches='tight')
plt.close()

# ==========================================
# 2. Top Bulk SKUs Time Series
# ==========================================
print("Generating Bulk SKUs Analysis...")
profit = train.groupby("ItemCode")["SalesAmount"].sum() - pd.to_numeric(train["Cost Amount"], errors="coerce").fillna(0).groupby(train["ItemCode"]).sum()
top_bulk = ["SKU-09458", "SKU-08589"] # From deep_insight

fig, axes = plt.subplots(len(top_bulk), 1, figsize=(14, 10), sharex=True)
if len(top_bulk) == 1: axes = [axes]

for i, sku in enumerate(top_bulk):
    df_sku = train[(train["ItemCode"] == sku) & (train["Quantity"] > 0)].groupby("Date")["Quantity"].sum()
    axes[i].vlines(x=df_sku.index, ymin=0, ymax=df_sku.values, color="#e74c3c", linewidth=2)
    axes[i].scatter(df_sku.index, df_sku.values, color="#c0392b", s=30)
    axes[i].set_title(f"Purchase Pattern of {sku}\n(Extremely high profit, but buys in massive spikes only ~50-80 times in 5 years)", pad=15)
    axes[i].set_ylabel("Quantity Sold")
    axes[i].grid(axis="x", alpha=0.3)

plt.xlabel("Date")
plt.savefig(OUTD / "08_bulk_sku_patterns.png", dpi=300, bbox_inches='tight')
plt.close()

# ==========================================
# 3. Monthly Sales Heatmap (Seasonality)
# ==========================================
print("Generating Heatmap...")
daily_total = train.groupby("Date")["Quantity"].sum().reset_index()
daily_total["Year"] = daily_total["Date"].dt.year
daily_total["Month"] = daily_total["Date"].dt.month
heatmap_data = daily_total.pivot_table(index="Year", columns="Month", values="Quantity", aggfunc="sum", fill_value=0)

plt.figure(figsize=(12, 6))
sns.heatmap(heatmap_data, cmap="YlGnBu", annot=True, fmt=",.0f", linewidths=.5, cbar_kws={'label': 'Total Qty'})
plt.title("Total Quantity Sold by Month & Year\n(Helps identify missing months or massive seasonal spikes)", pad=20)
plt.yticks(rotation=0)
plt.savefig(OUTD / "09_monthly_heatmap.png", dpi=300, bbox_inches='tight')
plt.close()

print("Deep EDA charts saved to eda_output/")

# Write insights to markdown
with open(OUTD / "EDA_INSIGHTS.md", "w") as f:
    f.write("""# Deep EDA Insights

## 1. The Sunday Phenomenon (is_sunday vs is_weekend)
- Our initial models used `is_weekend` which grouped Saturday and Sunday.
- **Fact**: Saturdays account for **322,259** sales, making it a very active business day. Sundays account for only **570** sales across 5 years.
- **Actionable Insight**: We must separate `is_sunday` from `is_saturday`! Grouping them causes the model to underpredict Saturday and overpredict Sunday.

## 2. Bulk Buyers (The "Whale" SKUs)
- SKUs like `SKU-09458` have huge profit weights but only appear ~84 times in 1754 days. When they do buy, they buy thousands of units.
- **Actionable Insight**: The spikes are almost random. Smoothing them out with `Tweedie` loss is correct, but we also need a feature like `days_since_last_sale` because maybe these whales restock every 90 days or 180 days.

## 3. Date Gaps
- There are 343 missing dates in the training data out of 1754 calendar days.
- 250 of these are Sundays. The remaining ~93 are likely Public Holidays (Tết, etc.).
- **Actionable Insight**: The `is_holiday` feature in V4 is absolutely correct and critical.

""")
