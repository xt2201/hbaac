# eda.py
"""
Exploratory Data Analysis — train_cleaned.csv
Xuất tất cả biểu đồ vào thư mục outputs/eda/

Chạy:
    python3 eda.py
"""

import os
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
INPUT_CSV = "data/train_cleaned.csv"
OUT_DIR   = "outputs/eda"
os.makedirs(OUT_DIR, exist_ok=True)

sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams.update({"figure.dpi": 120, "figure.figsize": (14, 5)})

def savefig(name: str):
    path = f"{OUT_DIR}/{name}.png"
    plt.tight_layout()
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved → {path}")

fmt_vnd = mticker.FuncFormatter(lambda x, _: f"{x/1e9:.1f}B")

# ── Load ──────────────────────────────────────────────────────────────────────
print("Loading data ...")
df = pd.read_csv(INPUT_CSV, parse_dates=["Date"])
df["Profit"]    = df["SalesAmount"] - df["Cost Amount"]
df["Month"]     = df["Date"].dt.to_period("M")
df["YearMonth"] = df["Date"].dt.to_period("M").dt.to_timestamp()
df["DayOfWeek"] = df["Date"].dt.day_name()
df["MonthNum"]  = df["Date"].dt.month
df["Year"]      = df["Date"].dt.year
print(f"  {len(df):,} rows | {df['ItemCode'].nunique():,} SKUs | "
      f"{df['Date'].min().date()} → {df['Date'].max().date()}")


# ════════════════════════════════════════════════════════════════
# 1. TỔNG QUAN THỐNG KÊ
# ════════════════════════════════════════════════════════════════
print("\n[1] Thống kê tổng quan")
print(df[["Quantity", "UnitPrice", "SalesAmount", "Unit Cost", "Cost Amount", "Profit"]]
      .describe().round(2).to_string())


# ════════════════════════════════════════════════════════════════
# 2. DOANH THU THEO THÁNG
# ════════════════════════════════════════════════════════════════
print("\n[2] Doanh thu theo tháng ...")
monthly = df.groupby("YearMonth")[["SalesAmount", "Cost Amount", "Profit"]].sum()

fig, axes = plt.subplots(1, 2, figsize=(16, 5))

axes[0].bar(monthly.index, monthly["SalesAmount"] / 1e9,
            color="steelblue", alpha=0.8, label="Revenue")
axes[0].bar(monthly.index, monthly["Cost Amount"] / 1e9,
            color="salmon", alpha=0.7, label="Cost")
axes[0].set_title("Doanh thu & Chi phí theo tháng (tỷ VND)")
axes[0].set_ylabel("Tỷ VND")
axes[0].legend()
axes[0].tick_params(axis="x", rotation=45)

axes[1].plot(monthly.index, monthly["Profit"] / 1e9,
             color="seagreen", marker="o", markersize=3, linewidth=1.5)
axes[1].fill_between(monthly.index, monthly["Profit"] / 1e9,
                     alpha=0.2, color="seagreen")
axes[1].axhline(0, color="red", linestyle="--", linewidth=0.8)
axes[1].set_title("Lợi nhuận theo tháng (tỷ VND)")
axes[1].set_ylabel("Tỷ VND")
axes[1].tick_params(axis="x", rotation=45)

savefig("01_monthly_revenue")


# ════════════════════════════════════════════════════════════════
# 3. SỐ LƯỢNG BÁN THEO NGÀY (time series tổng hợp)
# ════════════════════════════════════════════════════════════════
print("[3] Số lượng bán theo ngày ...")
daily_qty = df.groupby("Date")["Quantity"].sum()
daily_qty_roll = daily_qty.rolling(7).mean()

fig, ax = plt.subplots(figsize=(16, 5))
ax.plot(daily_qty.index, daily_qty.values,
        alpha=0.3, color="steelblue", linewidth=0.8, label="Daily")
ax.plot(daily_qty_roll.index, daily_qty_roll.values,
        color="navy", linewidth=1.8, label="7-day MA")
ax.set_title("Tổng số lượng bán theo ngày")
ax.set_ylabel("Quantity")
ax.legend()
savefig("02_daily_quantity")


# ════════════════════════════════════════════════════════════════
# 4. TOP 20 SKU THEO DOANH THU & LỢI NHUẬN
# ════════════════════════════════════════════════════════════════
print("[4] Top SKU ...")
sku_stats = (df.groupby("ItemCode")
               .agg(revenue=("SalesAmount", "sum"),
                    profit=("Profit", "sum"),
                    qty=("Quantity", "sum"),
                    n_days=("Date", "nunique"))
               .reset_index()
               .sort_values("revenue", ascending=False))

fig, axes = plt.subplots(1, 2, figsize=(18, 6))

top20_rev = sku_stats.head(20)
axes[0].barh(top20_rev["ItemCode"][::-1], top20_rev["revenue"][::-1] / 1e9,
             color="steelblue", alpha=0.85)
axes[0].set_title("Top 20 SKU theo Doanh thu (tỷ VND)")
axes[0].set_xlabel("Tỷ VND")

top20_profit = sku_stats.sort_values("profit", ascending=False).head(20)
axes[1].barh(top20_profit["ItemCode"][::-1], top20_profit["profit"][::-1] / 1e9,
             color="seagreen", alpha=0.85)
axes[1].set_title("Top 20 SKU theo Lợi nhuận (tỷ VND)")
axes[1].set_xlabel("Tỷ VND")

savefig("03_top20_skus")


# ════════════════════════════════════════════════════════════════
# 5. PHÂN PHỐI QUANTITY
# ════════════════════════════════════════════════════════════════
print("[5] Phân phối Quantity ...")
qty_clip = df["Quantity"].clip(0, df["Quantity"].quantile(0.99))

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
axes[0].hist(qty_clip, bins=60, color="steelblue", alpha=0.8, edgecolor="white")
axes[0].set_title("Phân phối Quantity (clip 99th pct)")
axes[0].set_xlabel("Quantity")
axes[0].set_ylabel("Frequency")

axes[1].boxplot(qty_clip, vert=True, patch_artist=True,
                boxprops=dict(facecolor="steelblue", alpha=0.6))
axes[1].set_title("Boxplot Quantity")
axes[1].set_ylabel("Quantity")

savefig("04_quantity_distribution")


# ════════════════════════════════════════════════════════════════
# 6. SEASONALITY — NGÀY TRONG TUẦN & THÁNG TRONG NĂM
# ════════════════════════════════════════════════════════════════
print("[6] Seasonality ...")
dow_order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
dow_stats = (df.groupby("DayOfWeek")["Quantity"].mean()
               .reindex(dow_order))

month_stats = df.groupby("MonthNum")["Quantity"].mean()

fig, axes = plt.subplots(1, 2, figsize=(16, 5))

axes[0].bar(dow_stats.index, dow_stats.values, color="mediumpurple", alpha=0.85)
axes[0].set_title("Số lượng trung bình theo ngày trong tuần")
axes[0].set_ylabel("Avg Quantity")
axes[0].tick_params(axis="x", rotation=30)

axes[1].bar(month_stats.index, month_stats.values, color="coral", alpha=0.85)
axes[1].set_title("Số lượng trung bình theo tháng trong năm")
axes[1].set_xlabel("Tháng")
axes[1].set_ylabel("Avg Quantity")
axes[1].set_xticks(range(1, 13))

savefig("05_seasonality")


# ════════════════════════════════════════════════════════════════
# 7. PHÂN TÍCH GIÁ (UnitPrice)
# ════════════════════════════════════════════════════════════════
print("[7] Phân tích giá ...")
price_clip = df["UnitPrice"].clip(0, df["UnitPrice"].quantile(0.99))

# Price buckets
bins   = [0, 200e3, 500e3, 1e6, 3e6, 10e6, float("inf")]
labels = ["<200K", "200-500K", "500K-1M", "1-3M", "3-10M", ">10M"]
df["PriceBucket"] = pd.cut(df["UnitPrice"], bins=bins, labels=labels)
bucket_qty = df.groupby("PriceBucket", observed=True)["Quantity"].sum()

fig, axes = plt.subplots(1, 2, figsize=(16, 5))
axes[0].hist(price_clip / 1e3, bins=60, color="darkorange", alpha=0.8, edgecolor="white")
axes[0].set_title("Phân phối UnitPrice (clip 99th pct)")
axes[0].set_xlabel("Giá (nghìn VND)")
axes[0].set_ylabel("Frequency")

axes[1].bar(bucket_qty.index, bucket_qty.values / 1e3, color="darkorange", alpha=0.85)
axes[1].set_title("Tổng số lượng bán theo phân khúc giá")
axes[1].set_xlabel("Phân khúc giá")
axes[1].set_ylabel("Quantity (nghìn)")
axes[1].tick_params(axis="x", rotation=20)

savefig("06_price_analysis")


# ════════════════════════════════════════════════════════════════
# 8. SỐ NGÀY ACTIVE & ZERO-SALES PER SKU
# ════════════════════════════════════════════════════════════════
print("[8] SKU activity ...")
total_days = (df["Date"].max() - df["Date"].min()).days + 1
sku_active = sku_stats["n_days"]
sparsity   = 1 - sku_active / total_days

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
axes[0].hist(sku_active, bins=40, color="teal", alpha=0.8, edgecolor="white")
axes[0].set_title("Số ngày có giao dịch / SKU")
axes[0].set_xlabel("Số ngày active")
axes[0].set_ylabel("Số SKU")

axes[1].hist(sparsity * 100, bins=40, color="tomato", alpha=0.8, edgecolor="white")
axes[1].set_title("Mức độ thưa (% ngày không có giao dịch) / SKU")
axes[1].set_xlabel("Sparsity (%)")
axes[1].set_ylabel("Số SKU")
axes[1].axvline(sparsity.median() * 100, color="black",
                linestyle="--", label=f"Median={sparsity.median()*100:.0f}%")
axes[1].legend()

savefig("07_sku_activity")


# ════════════════════════════════════════════════════════════════
# 9. CORRELATION MATRIX
# ════════════════════════════════════════════════════════════════
print("[9] Correlation matrix ...")
corr_cols = ["Quantity", "UnitPrice", "SalesAmount", "Unit Cost", "Cost Amount", "Profit"]
corr = df[corr_cols].corr()

fig, ax = plt.subplots(figsize=(9, 7))
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=True, fmt=".2f", cmap="coolwarm",
            center=0, vmin=-1, vmax=1, ax=ax, square=True,
            linewidths=0.5)
ax.set_title("Correlation Matrix")
savefig("08_correlation")


# ════════════════════════════════════════════════════════════════
# 10. TOP 5 SKU — TIME SERIES RIÊNG
# ════════════════════════════════════════════════════════════════
print("[10] Top 5 SKU time series ...")
top5 = sku_stats.head(5)["ItemCode"].tolist()
fig, axes = plt.subplots(5, 1, figsize=(16, 14), sharex=True)

for ax, sku in zip(axes, top5):
    ts = (df[df["ItemCode"] == sku]
          .groupby("Date")["Quantity"].sum()
          .resample("D").sum()
          .fillna(0))
    ax.fill_between(ts.index, ts.values, alpha=0.5, color="steelblue")
    ax.plot(ts.index, ts.rolling(14).mean(), color="navy", linewidth=1.2)
    ax.set_ylabel(sku, fontsize=8, rotation=0, labelpad=60)
    ax.set_ylim(bottom=0)

axes[-1].set_xlabel("Date")
fig.suptitle("Top 5 SKU — Daily Quantity (14-day MA)", y=1.01)
savefig("09_top5_sku_timeseries")


# ════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════
print(f"""
╔══════════════════════════════════════════════╗
  EDA hoàn tất — {len(os.listdir(OUT_DIR))} biểu đồ đã lưu tại {OUT_DIR}/

  Tóm tắt:
  • Tổng giao dịch : {len(df):,}
  • Tổng SKU       : {df['ItemCode'].nunique():,}
  • Khoảng thời gian: {df['Date'].min().date()} → {df['Date'].max().date()}
  • Tổng doanh thu : {df['SalesAmount'].sum()/1e12:.2f} nghìn tỷ VND
  • Tổng lợi nhuận : {df['Profit'].sum()/1e12:.2f} nghìn tỷ VND
  • Biên lợi nhuận : {df['Profit'].sum()/df['SalesAmount'].sum()*100:.1f}%
  • SKU lợi nhuận âm: {(sku_stats['profit'] < 0).sum():,}
╚══════════════════════════════════════════════╝
""")
