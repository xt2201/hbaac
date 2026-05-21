"""
HBAAC Deep EDA v2 — charts 01-18 + EDA_REPORT.md
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, EDA_DIR, PROC_DIR, TRAIN_END, TRAIN_START, VALID_START
from v5_features import ALL_HOLIDAYS
from vn_calendar import build_all_holidays_feature_dates, legacy_all_holidays_index

EDA_DIR.mkdir(exist_ok=True)
plt.style.use("seaborn-v0_8-whitegrid")
plt.rcParams.update({"font.size": 11, "figure.autolayout": True})

TRAIN_END_TS = pd.Timestamp(TRAIN_END)
TRAIN_START_TS = pd.Timestamp(TRAIN_START)
VALID_START_TS = pd.Timestamp(VALID_START)
PRIVATE_START = VALID_START_TS + pd.Timedelta(days=28)
DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

print("=" * 70)
print("HBAAC  |  Deep EDA v2")
print("=" * 70)

# ─── Load ─────────────────────────────────────────────────────────────────────
train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0).astype(int)
train["SalesAmount"] = pd.to_numeric(train["SalesAmount"], errors="coerce").fillna(0)
train["Cost Amount"] = pd.to_numeric(train["Cost Amount"], errors="coerce").fillna(0)

daily_tx = train.groupby("Date").agg(
    qty=("Quantity", "sum"),
    gross=("Quantity", lambda x: x[x > 0].sum()),
    returns=("Quantity", lambda x: x[x < 0].sum()),
    n_txn=("Quantity", "count"),
).reset_index()
daily_tx["returns"] = daily_tx["returns"].abs()
daily_tx["net_qty"] = daily_tx["qty"]
daily_tx["return_rate"] = daily_tx["returns"] / (daily_tx["gross"] + 1e-6)

all_dates = pd.date_range(daily_tx["Date"].min(), daily_tx["Date"].max(), freq="D")
calendar = pd.DataFrame({"Date": all_dates})
calendar["dayofweek"] = calendar["Date"].dt.dayofweek
calendar = calendar.merge(daily_tx, on="Date", how="left")
calendar["qty"] = calendar["qty"].fillna(0)
calendar["gross"] = calendar["gross"].fillna(0)
calendar["returns"] = calendar["returns"].fillna(0)
calendar["return_rate"] = calendar["return_rate"].fillna(0)

tx_dates = set(train["Date"].unique())
missing_dates = [d for d in all_dates if d not in tx_dates]
missing_df = pd.DataFrame({"Date": missing_dates})
missing_df["dayofweek"] = missing_df["Date"].dt.dayofweek

stats = {}  # collect for report

# ─── 01 Daily total sales ─────────────────────────────────────────────────────
print("[01] Daily total sales …")
post2022 = calendar[calendar["Date"] >= TRAIN_START_TS]
spike_thresh = 8000
spike_days = post2022[post2022["qty"] > spike_thresh]

fig, ax = plt.subplots(figsize=(14, 5))
ax.plot(calendar["Date"], calendar["qty"], linewidth=0.8, alpha=0.7, label="Daily qty")
ax.axvline(TRAIN_START_TS, color="red", linestyle="--", label="Regime 2022")
if len(spike_days) > 0:
    ax.scatter(spike_days["Date"], spike_days["qty"], color="orange", s=40, zorder=5, label=f"Spike >{spike_thresh}")
ax.set_title("01 — Daily Total Quantity (regime shift 2022, spike days marked)")
ax.set_ylabel("Total qty")
ax.legend(loc="upper left")
plt.savefig(EDA_DIR / "01_daily_total_sales.png", dpi=200, bbox_inches="tight")
plt.close()

year_stats = calendar.groupby(calendar["Date"].dt.year)["qty"].agg(["sum", "mean", "max"])
stats["spike_days_count"] = len(spike_days)
stats["spike_max"] = int(post2022["qty"].max()) if len(post2022) else 0

# ─── 02 Monthly seasonality ───────────────────────────────────────────────────
print("[02] Monthly heatmap …")
daily_tx["Year"] = daily_tx["Date"].dt.year
daily_tx["Month"] = daily_tx["Date"].dt.month
hm = daily_tx.groupby(["Year", "Month"])["qty"].sum().unstack(fill_value=0)

fig, ax = plt.subplots(figsize=(12, 5))
sns.heatmap(hm, cmap="YlGnBu", annot=True, fmt=",.0f", linewidths=0.5, ax=ax)
ax.set_title("02 — Monthly Total Quantity by Year (Sep-2025 partial)")
plt.savefig(EDA_DIR / "02_monthly_seasonality.png", dpi=200, bbox_inches="tight")
plt.close()

sep2025 = daily_tx[(daily_tx["Year"] == 2025) & (daily_tx["Month"] == 9)]["qty"].sum()
stats["sep2025_partial_qty"] = int(sep2025)

# ─── 03 DOW seasonality (calendar fill 0) ─────────────────────────────────────
print("[03] DOW seasonality …")
dow_cal = calendar.groupby("dayofweek")["qty"].mean()
dow_cal.index = DOW_NAMES

fig, ax = plt.subplots(figsize=(9, 5))
dow_cal.plot(kind="bar", ax=ax, color="#3498db")
ax.set_title("03 — Avg Daily Qty by DOW (calendar reindex, fill 0)")
ax.set_ylabel("Avg daily qty")
plt.savefig(EDA_DIR / "03_dow_seasonality.png", dpi=200, bbox_inches="tight")
plt.close()

stats["sun_avg_qty"] = float(dow_cal.get("Sun", 0))
stats["sat_avg_qty"] = float(dow_cal.get("Sat", 0))
stats["mon_avg_qty"] = float(dow_cal.get("Mon", 0))

# ─── 04 Profit weight distribution ────────────────────────────────────────────
print("[04] Profit weight …")
if (PROC_DIR / "sku_weights.csv").exists():
    sw = pd.read_csv(PROC_DIR / "sku_weights.csv").sort_values("weight", ascending=False)
    sw["cum_weight"] = sw["weight"].cumsum()
    top50_w = sw.head(50)["weight"].sum()
    top200_w = sw.head(200)["weight"].sum()
    stats["top50_weight_pct"] = float(top50_w * 100)
    stats["top200_weight_pct"] = float(top200_w * 100)
    stats["top1_weight_pct"] = float(sw.iloc[0]["weight"] * 100)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(range(1, len(sw) + 1), sw["cum_weight"].values * 100)
    ax.axhline(80, color="gray", linestyle="--", label="80% weight")
    ax.axvline(50, color="green", linestyle=":", label="Top-50")
    ax.axvline(200, color="orange", linestyle=":", label="Top-200")
    ax.set_xlabel("SKU rank by profit weight")
    ax.set_ylabel("Cumulative weight %")
    ax.set_title("04 — Cumulative WRMSSE Profit Weight (Pareto)")
    ax.legend()
    plt.savefig(EDA_DIR / "04_profit_weight_distribution.png", dpi=200, bbox_inches="tight")
    plt.close()
else:
    sw = None
    stats["top50_weight_pct"] = stats["top200_weight_pct"] = 0

# ─── 05 SKU transaction distribution ──────────────────────────────────────────
print("[05] Transaction distribution …")
txn_per_sku = train.groupby("ItemCode").size()
stats["sku_median_txn"] = int(txn_per_sku.median())
stats["sku_le10_txn_pct"] = float((txn_per_sku <= 10).mean() * 100)
stats["sku_ge1000_txn"] = int((txn_per_sku >= 1000).sum())

fig, ax = plt.subplots(figsize=(10, 5))
ax.hist(np.log1p(txn_per_sku), bins=80, color="#2c3e50", edgecolor="white")
ax.set_xlabel("log1p(transaction lines per SKU)")
ax.set_ylabel("SKU count")
ax.set_title(f"05 — SKU Transaction Lines (median={stats['sku_median_txn']}, ≤10 txns={stats['sku_le10_txn_pct']:.1f}%)")
plt.savefig(EDA_DIR / "05_sku_transaction_dist.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 06 Return rate monthly ─────────────────────────────────────────────────────
print("[06] Return rate monthly …")
monthly_ret = daily_tx.copy()
monthly_ret["ym"] = monthly_ret["Date"].dt.to_period("M")
mr = monthly_ret.groupby("ym")["return_rate"].mean() * 100

fig, ax = plt.subplots(figsize=(14, 4))
mr.plot(ax=ax, color="#e74c3c")
ax.axvline(pd.Period("2022-01"), color="blue", linestyle="--", label="Regime 2022")
ax.set_ylabel("Return rate % of gross")
ax.set_title("06 — Monthly Return Rate (returns/gross qty)")
ax.legend()
plt.savefig(EDA_DIR / "06_return_rate_monthly.png", dpi=200, bbox_inches="tight")
plt.close()

pre2022_ret = calendar[calendar["Date"] < TRAIN_START_TS]["return_rate"].mean() * 100
post2022_ret = calendar[calendar["Date"] >= TRAIN_START_TS]["return_rate"].mean() * 100
stats["return_pre2022_pct"] = float(pre2022_ret)
stats["return_post2022_pct"] = float(post2022_ret)

# ─── 07 DOW deep (positive tx only) ───────────────────────────────────────────
print("[07] DOW deep …")
pos = train[train["Quantity"] > 0]
dow_pos = pos.groupby(pos["Date"].dt.dayofweek)["Quantity"].sum()
dow_pos.index = DOW_NAMES

fig, ax = plt.subplots(figsize=(9, 5))
dow_pos.plot(kind="bar", ax=ax, color="#2c3e50")
for i, v in enumerate(dow_pos.values):
    ax.text(i, v + v * 0.02, f"{int(v):,}", ha="center", fontsize=9)
ax.set_title("07 — Total Qty by DOW (positive transactions only; Sunday ≈ closed)")
plt.savefig(EDA_DIR / "07_dow_deep_analysis.png", dpi=200, bbox_inches="tight")
plt.close()

stats["sun_total_5y"] = int(dow_pos.get("Sun", 0))

# ─── 08 Bulk SKU patterns ───────────────────────────────────────────────────────
print("[08] Bulk SKU patterns …")
whales = ["SKU-09458", "SKU-08589", "SKU-00003"]
fig, axes = plt.subplots(len(whales), 1, figsize=(14, 3 * len(whales)), sharex=True)
if len(whales) == 1:
    axes = [axes]
for ax, sku in zip(axes, whales):
    s = train[(train["ItemCode"] == sku) & (train["Quantity"] > 0)].groupby("Date")["Quantity"].sum()
    ax.vlines(s.index, 0, s.values, color="#e74c3c", linewidth=1.5)
    ax.scatter(s.index, s.values, s=20, color="#c0392b")
    ax.set_title(f"{sku} — intermittent spikes")
    ax.set_ylabel("Qty")
plt.xlabel("Date")
plt.savefig(EDA_DIR / "08_bulk_sku_patterns.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 09 Monthly heatmap (duplicate style from v1) ─────────────────────────────
print("[09] Heatmap …")
fig, ax = plt.subplots(figsize=(12, 5))
sns.heatmap(hm, cmap="YlGnBu", annot=True, fmt=",.0f", linewidths=0.5, ax=ax)
ax.set_title("09 — Monthly Heatmap (duplicate for continuity)")
plt.savefig(EDA_DIR / "09_monthly_heatmap.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 10 Missing days & holiday audit ──────────────────────────────────────────
print("[10] Missing days audit …")
n_missing = len(missing_dates)
n_missing_sun = (missing_df["dayofweek"] == 6).sum()
non_sun_missing = missing_df[missing_df["dayofweek"] != 6].copy()
non_sun_missing["is_known_holiday"] = non_sun_missing["Date"].isin(ALL_HOLIDAYS)
unmapped = non_sun_missing[~non_sun_missing["is_known_holiday"]]

stats["missing_days_total"] = n_missing
stats["missing_sunday"] = int(n_missing_sun)
stats["missing_non_sunday"] = int(len(non_sun_missing))
stats["unmapped_gaps"] = int(len(unmapped))
stats["all_holidays_count"] = int(len(ALL_HOLIDAYS))
stats["legacy_holidays_count"] = int(len(legacy_all_holidays_index()))
stats["legacy_unmapped_gaps"] = int(
    len(non_sun_missing[~non_sun_missing["Date"].isin(legacy_all_holidays_index())])
)

fig, ax = plt.subplots(figsize=(8, 4))
ax.bar(["Sunday", "Non-Sunday"], [n_missing_sun, len(non_sun_missing)], color=["#9b59b6", "#e67e22"])
ax.set_title(f"10 — Missing Calendar Days ({n_missing} total, {100*n_missing_sun/n_missing:.0f}% Sunday)")
ax.set_ylabel("Count")
plt.savefig(EDA_DIR / "10_missing_days_audit.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 11 Pre/post holiday effect ─────────────────────────────────────────────────
print("[11] Pre/post holiday …")
holiday_set = set(ALL_HOLIDAYS)
offsets = range(-3, 4)
hol_effect = []
for off in offsets:
    rows = []
    for h in ALL_HOLIDAYS:
        d = h + pd.Timedelta(days=off)
        if d in calendar["Date"].values:
            rows.append(calendar.loc[calendar["Date"] == d, "qty"].values[0])
    hol_effect.append(np.mean(rows) if rows else 0)
weekday_base = calendar[(calendar["dayofweek"] < 5) & (~calendar["Date"].isin(holiday_set))]["qty"].mean()

fig, ax = plt.subplots(figsize=(9, 4))
ax.bar(list(offsets), hol_effect, color="#1abc9c")
ax.axhline(weekday_base, color="gray", linestyle="--", label=f"Weekday baseline={weekday_base:.0f}")
ax.set_xlabel("Days relative to holiday")
ax.set_title("11 — Avg Daily Qty Pre/Post Holiday (-3..+3)")
ax.legend()
plt.savefig(EDA_DIR / "11_pre_post_holiday.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 12 Saturday by month ─────────────────────────────────────────────────────
print("[12] Saturday by month …")
sat = calendar[calendar["dayofweek"] == 5].copy()
sat["ym"] = sat["Date"].dt.to_period("M")
sat_monthly = sat.groupby("ym")["qty"].mean()

fig, ax = plt.subplots(figsize=(14, 4))
sat_monthly.plot(ax=ax, color="#8e44ad")
ax.set_title("12 — Avg Saturday Daily Qty by Month")
ax.set_ylabel("Avg qty")
plt.savefig(EDA_DIR / "12_saturday_by_month.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 13 Forecast window calendar ──────────────────────────────────────────────
print("[13] Forecast windows …")
pub_dates = pd.date_range(VALID_START_TS, periods=28, freq="D")
priv_dates = pd.date_range(PRIVATE_START, periods=28, freq="D")
pub_sun = (pub_dates.dayofweek == 6).sum()
pub_sat = (pub_dates.dayofweek == 5).sum()
priv_sun = (priv_dates.dayofweek == 6).sum()
priv_sat = (priv_dates.dayofweek == 5).sum()
stats["public_sundays"] = int(pub_sun)
stats["public_saturdays"] = int(pub_sat)
stats["private_sundays"] = int(priv_sun)
stats["private_saturdays"] = int(priv_sat)

fig, ax = plt.subplots(figsize=(10, 3))
labels = ["Public\nSep-Oct", "Private\nOctober"]
sun_ct = [pub_sun, priv_sun]
sat_ct = [pub_sat, priv_sat]
x = np.arange(2)
ax.bar(x - 0.2, sun_ct, 0.35, label="Sundays (hard-zero)", color="#c0392b")
ax.bar(x + 0.2, sat_ct, 0.35, label="Saturdays", color="#8e44ad")
ax.set_xticks(x)
ax.set_xticklabels(labels)
ax.set_title("13 — Sundays/Saturdays in Forecast Windows (28d each)")
ax.legend()
plt.savefig(EDA_DIR / "13_forecast_window_calendar.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 14 YoY October profile ─────────────────────────────────────────────────────
print("[14] YoY October …")
oct_cal = calendar[(calendar["Date"].dt.month == 10) & (calendar["Date"].dt.year >= 2022)]
oct_daily = oct_cal.groupby([oct_cal["Date"].dt.year, oct_cal["Date"].dt.day])["qty"].mean().unstack(0)

fig, ax = plt.subplots(figsize=(12, 5))
for yr in sorted(oct_daily.columns):
    ax.plot(oct_daily.index, oct_daily[yr], label=str(yr), marker="o", markersize=3)
ax.set_xlabel("Day of October")
ax.set_title("14 — YoY October Avg Daily Qty (2022-2024) vs Private window 2025-10")
ax.legend()
plt.savefig(EDA_DIR / "14_yoy_october_profile.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 15 Return by DOW (post-2022, weekdays with sales only) ───────────────────
print("[15] Return by DOW …")
post = calendar[(calendar["Date"] >= TRAIN_START_TS) & (calendar["gross"] > 100)]
ret_dow = post.groupby("dayofweek").apply(
    lambda g: (g["returns"].sum() / (g["gross"].sum() + 1e-6)) * 100
)
ret_dow.index = DOW_NAMES
stats["return_post2022_pct"] = float(
    post["returns"].sum() / (post["gross"].sum() + 1e-6) * 100
)

fig, ax = plt.subplots(figsize=(9, 4))
ret_dow.plot(kind="bar", ax=ax, color="#e74c3c")
ax.set_title(f"15 — Return Rate by DOW (post-2022 avg={stats['return_post2022_pct']:.2f}%)")
ax.set_ylabel("Return rate %")
plt.savefig(EDA_DIR / "15_return_by_dow.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 16 Inter-arrival whale SKUs ──────────────────────────────────────────────
print("[16] Inter-arrival …")
fig, axes = plt.subplots(1, 3, figsize=(14, 4))
for ax, sku in zip(axes, whales):
    dates = train[(train["ItemCode"] == sku) & (train["Quantity"] > 0)]["Date"].drop_duplicates().sort_values()
    if len(dates) > 1:
        gaps = dates.diff().dt.days.dropna()
        ax.hist(gaps, bins=30, color="#3498db", edgecolor="white")
        ax.set_title(f"{sku}\nmedian gap={gaps.median():.0f}d")
    else:
        ax.set_title(f"{sku} — insufficient data")
plt.suptitle("16 — Inter-arrival Days Between Positive Sale Days")
plt.savefig(EDA_DIR / "16_inter_arrival_whales.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 17 Global spike day contribution ─────────────────────────────────────────
print("[17] Spike contribution …")
if len(spike_days) > 0:
    spike_date_list = spike_days["Date"].tolist()
    spike_rows = train[train["Date"].isin(spike_date_list)]
    top_on_spike = (
        spike_rows[spike_rows["Quantity"] > 0]
        .groupby("ItemCode")["Quantity"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
    )
    fig, ax = plt.subplots(figsize=(10, 5))
    top_on_spike.plot(kind="barh", ax=ax, color="#f39c12")
    ax.set_title(f"17 — Top SKU Qty on Global Spike Days (n={len(spike_days)})")
    plt.savefig(EDA_DIR / "17_spike_day_top_sku.png", dpi=200, bbox_inches="tight")
    plt.close()

# ─── 18 Lag-364 YoY correlation top SKUs ──────────────────────────────────────
print("[18] Lag-364 YoY …")
if sw is not None:
    top_skus = sw.head(50)["ItemCode"].tolist()
    daily_sku = (
        train.groupby(["Date", "ItemCode"])["Quantity"]
        .sum()
        .reset_index()
        .pivot(index="Date", columns="ItemCode", values="Quantity")
        .fillna(0)
        .reindex(all_dates, fill_value=0)
    )
    corrs = []
    for sku in top_skus[:20]:
        if sku not in daily_sku.columns:
            continue
        s = daily_sku[sku]
        y1 = s.shift(364)
        mask = (s > 0) & (y1 > 0)
        if mask.sum() > 10:
            corrs.append(np.corrcoef(s[mask], y1[mask])[0, 1])
    stats["lag364_corr_median_top20"] = float(np.median(corrs)) if corrs else 0

    fig, ax = plt.subplots(figsize=(8, 4))
    if corrs:
        ax.hist(corrs, bins=15, color="#27ae60", edgecolor="white")
        ax.axvline(np.median(corrs), color="red", linestyle="--", label=f"median={np.median(corrs):.2f}")
    ax.set_title("18 — YoY lag-364 Correlation (top-20 SKUs, days with sales)")
    ax.set_xlabel("Correlation")
    ax.legend()
    plt.savefig(EDA_DIR / "18_lag364_yoy_correlation.png", dpi=200, bbox_inches="tight")
    plt.close()

# ─── 21–22 Deep calendar (post-2022 low volume + missing by year) ─────────────
print("[21] Low-volume month×DOW heatmap …")
post_cal = calendar[calendar["Date"] >= TRAIN_START_TS].copy()
post_cal["dow_name"] = post_cal["dayofweek"].map(dict(enumerate(DOW_NAMES)))
dow_med = post_cal.groupby("dayofweek")["gross"].transform("median")
post_cal["vs_dow_median_ratio"] = post_cal["gross"] / (dow_med + 1e-6)
post_cal["month"] = post_cal["Date"].dt.month
piv21 = post_cal.pivot_table(
    index="month", columns="dow_name", values="vs_dow_median_ratio", aggfunc="median"
)
fig, ax = plt.subplots(figsize=(10, 6))
sns.heatmap(piv21.reindex(columns=DOW_NAMES), ax=ax, cmap="RdYlGn", center=1.0, vmin=0, vmax=2)
ax.set_title("21 — Median vs-DOW volume ratio by month (post-2022)")
plt.savefig(EDA_DIR / "21_low_volume_month_dow.png", dpi=200, bbox_inches="tight")
plt.close()

print("[22] Missing days by year …")
miss_cal = calendar[calendar["Date"].isin(missing_dates)].copy()
miss_cal["year"] = miss_cal["Date"].dt.year
miss_cal["classification"] = "MISSING_SUNDAY_CLOSED"
miss_cal.loc[miss_cal["dayofweek"] != 6, "classification"] = "MISSING_NON_SUNDAY"
miss_cal.loc[
    miss_cal["dayofweek"] != 6 & miss_cal["Date"].isin(ALL_HOLIDAYS),
    "classification",
] = "MISSING_VN_HOLIDAY_TAGGED"
fig, ax = plt.subplots(figsize=(10, 4))
miss_cal.groupby(["year", "classification"]).size().unstack(fill_value=0).plot(
    kind="bar", stacked=True, ax=ax
)
ax.set_title("22 — Missing days by year and class")
ax.legend(bbox_to_anchor=(1.02, 1), fontsize=8)
plt.tight_layout()
plt.savefig(EDA_DIR / "22_missing_by_year.png", dpi=200, bbox_inches="tight")
plt.close()

low_vol_post = post_cal[(post_cal["gross"] > 0) & (post_cal["vs_dow_median_ratio"] < 0.15)]
stats["low_volume_days_post2022"] = int(len(low_vol_post))
assert len(build_all_holidays_feature_dates()) == len(ALL_HOLIDAYS)

# ─── Write EDA_REPORT.md ──────────────────────────────────────────────────────
print("\nWriting EDA_REPORT.md …")
unmapped_dates = unmapped["Date"].dt.strftime("%Y-%m-%d").tolist()[:20]

report = f"""# HBAAC Deep EDA Report (v2)

Generated by `scripts/run_eda_v2.py`.

## Executive summary

1. **Regime shift 2022**: Train from `2022-01-01`; pre-2022 avg daily qty is noise at ~9× lower scale.
2. **Sunday ≈ closed**: {stats.get('sun_total_5y', 0):,} total qty in 5y (positive tx); {stats.get('missing_sunday', 0)}/{stats.get('missing_days_total', 0)} missing calendar days are Sundays → **hard-zero Sunday** in forecast ({stats.get('public_sundays', 4)} Public + {stats.get('private_sundays', 4)} Private Sundays).
3. **Saturday ≠ weekend**: Sat avg {stats.get('sat_avg_qty', 0):.0f} vs Sun {stats.get('sun_avg_qty', 0):.1f} (calendar-fill); use `is_saturday` separate from `is_sunday`; do not blend DOW naive across weekend.
4. **Pareto WRMSSE**: Top-1 SKU ≈ {stats.get('top1_weight_pct', 0):.1f}% weight; top-50 ≈ {stats.get('top50_weight_pct', 0):.1f}%; top-200 ≈ {stats.get('top200_weight_pct', 0):.1f}%.
5. **Sparse tail**: {stats.get('sku_le10_txn_pct', 0):.1f}% SKUs have ≤10 transaction lines (median {stats.get('sku_median_txn', 0)}) → Croston / two-stage / heavy shrink.
6. **Returns post-2022**: {stats.get('return_pre2022_pct', 0):.2f}% → {stats.get('return_post2022_pct', 0):.2f}% avg; October Private hurt by returns — use `return_rate_28d`, `expected_return_28d`.
7. **Sep-2025 partial**: only {stats.get('sep2025_partial_qty', 0):,} qty — exclude from rolling stats.
8. **Global spikes**: {stats.get('spike_days_count', 0)} days >8k qty (max {stats.get('spike_max', 0):,}) → `global_qty_index` feature.
9. **Holidays (V5.1)**: `ALL_HOLIDAYS` has **{stats.get('all_holidays_count', 0)}** dates (legacy {stats.get('legacy_holidays_count', 0)}); unmapped non-Sun gaps **{stats.get('unmapped_gaps', 0)}** (was {stats.get('legacy_unmapped_gaps', 0)}).
10. **YoY October**: lag-364 median corr (top-20) = {stats.get('lag364_corr_median_top20', 0):.2f} — keep `lag_364`, `is_october`.
11. **Deep calendar**: {stats.get('low_volume_days_post2022', 0)} post-2022 low-volume trading days; see charts 21–22 and `DEEP_CALENDAR_ANALYSIS.md`.

## Insight → Action table

| Insight | Action (feature / post-process) |
|---------|----------------------------------|
| Sunday closed | `is_sunday`, post-process `pred=0` on dow==6 |
| Saturday active | `is_saturday` (not `is_weekend` only) |
| Regime 2022 | `TRAIN_START=2022-01-01`, `decay_weight` |
| Sep-2025 partial | Mask in rolling / `global_qty_index` |
| Returns Oct peak | `return_rate_28d`, `expected_return_28d`, `gross_qty_lag1` |
| Top-200 weight | Dedicated model + horizon bias matrix |
| Tail ≤10 txns | Croston + two-stage zero-inflated |
| Spike days | `global_qty_index` |
| Holiday gaps (V5.1) | `ALL_HOLIDAYS` v2 via `vn_calendar`; `is_pre_holiday`, `days_since_holiday` |
| Private = October | `days_to_october`, `lag_364`, direct horizon h>28 |
| Recursive drift | Direct multi-horizon + blend α_h |

## Holiday gap audit (V5.1 `ALL_HOLIDAYS`)

| Metric | Legacy (~27) | V5.1 ({stats.get('all_holidays_count', 0)} dates) |
|--------|--------------|-----------------------------------------------------|
| Non-Sunday missing unmapped | {stats.get('legacy_unmapped_gaps', 0)} | **{stats.get('unmapped_gaps', 0)}** |
| Missing days total | {stats.get('missing_days_total', 0)} | (Sun {stats.get('missing_sunday', 0)}, non-Sun {stats.get('missing_non_sunday', 0)}) |

- Remaining unmapped (do **not** add ad-hoc): Mar 11/16 2021, post-Tet single days, pre-business Nov 2020.
- Full audit: `CALENDAR_AUDIT_REPORT.md`, `unknown_days_resolved.csv`, `proposed_ALL_HOLIDAYS_v2.csv`.
- Sample still-unmapped: {', '.join(unmapped_dates) if unmapped_dates else 'none'}

## Forecast windows

| Window | Dates | Sundays | Saturdays |
|--------|-------|---------|-----------|
| Public | {VALID_START} + 28d | {stats.get('public_sundays', 0)} | {stats.get('public_saturdays', 0)} |
| Private | {PRIVATE_START.date()} + 28d | {stats.get('private_sundays', 0)} | {stats.get('private_saturdays', 0)} |

## Charts

| # | File |
|---|------|
| 01 | `01_daily_total_sales.png` |
| 02 | `02_monthly_seasonality.png` |
| 03 | `03_dow_seasonality.png` |
| 04 | `04_profit_weight_distribution.png` |
| 05 | `05_sku_transaction_dist.png` |
| 06 | `06_return_rate_monthly.png` |
| 07 | `07_dow_deep_analysis.png` |
| 08 | `08_bulk_sku_patterns.png` |
| 09 | `09_monthly_heatmap.png` |
| 10 | `10_missing_days_audit.png` |
| 11 | `11_pre_post_holiday.png` |
| 12 | `12_saturday_by_month.png` |
| 13 | `13_forecast_window_calendar.png` |
| 14 | `14_yoy_october_profile.png` |
| 15 | `15_return_by_dow.png` |
| 16 | `16_inter_arrival_whales.png` |
| 17 | `17_spike_day_top_sku.png` |
| 18 | `18_lag364_yoy_correlation.png` |
| 21 | `21_low_volume_month_dow.png` — post-2022 median gross vs same-DOW |
| 22 | `22_missing_by_year.png` — missing days stacked by year |

## Deep calendar (charts 21–22)

- **Chart 21:** Months/DOW where median volume ≪ 1.0 vs same-DOW baseline → pre-holiday / Tet / year-end patterns.
- **Chart 22:** Most missing days are Sundays; 2021 spike in non-Sun missing (between New Year–Tet, year-end 2020).
- **17 UNKNOWN** days resolved in `unknown_days_resolved.csv` (not COVID for most).
- **V5.1 modeling:** `python scripts/pipeline_v51.py` → `submission_v51.csv` (same post-process as V5).

See also `DEEP_CALENDAR_ANALYSIS.md`.

## Bảng Insight → Feature (chart 09–18)

| # | Insight | Action | Ưu tiên |
|---|---------|--------|---------|
| 09 | Regime 2022+, Oct/Mar cao; Sep-2025=5,512 | `TRAIN_START`, mask Sep-2025, `is_october` | P0 |
| 10 | 72% gap = Chủ nhật | `is_sunday`, pred=0 | P0 |
| 11 | Pre-holiday −3..−1 giảm | `is_pre_holiday`, `days_since_holiday` (V5.1) | P1 |
| 12 | T7 ~1.2–1.9k sau 2022 | `is_saturday`, không shrink T7 | P0 |
| 13 | 4 CN + 4 T7 / cửa sổ 28d | Hard-zero 8 CN trong 56d | P0 |
| 14 | Oct YoY khác nhau | Direct h>28, cap spike | P0 |
| 15 | Return ~3.5% T2–T7 | `return_rate_28d` | P1 |
| 16 | Whale gap 6–8d | Croston + `days_since_last_sale` | P1 |
| 17 | Spike: SKU-09760 ~29k | `global_qty_index` | P1 |
| 18 | lag-364 corr ≈ 0 | Direct + `is_october` | P2 |
| 21 | Low vol vs DOW | Shrink when `vs_dow_median_ratio` low | P1 |
| 22 | Missing by year | Expanded `ALL_HOLIDAYS` V5.1 | P0 |

## Open questions

1. Remaining unmapped gaps — only add if recurring national pattern.
2. POST_TET_2021 single days — feature via `days_since_holiday`, not hard holiday list.
3. Whale inter-arrival — `days_since_last_sale` cap for top tier only.
"""

(EDA_DIR / "EDA_REPORT.md").write_text(report, encoding="utf-8")
(EDA_DIR / "EDA_STATS.md").write_text(report, encoding="utf-8")
print(f"Saved → {EDA_DIR / 'EDA_REPORT.md'}")
print(f"Charts → {EDA_DIR}/ (22 PNG)")
print("Done.")
