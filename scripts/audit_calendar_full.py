"""
Full calendar audit: every day in train range — missing, low volume, holiday classification.
No day omitted.
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, EDA_DIR
from vn_calendar import build_holiday_lookup, legacy_all_holidays_index

EDA_DIR.mkdir(exist_ok=True)

print("=" * 70)
print("HBAAC  |  Full Calendar Audit (no day skipped)")
print("=" * 70)

train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0)

daily = train.groupby("Date").agg(
    gross_qty=("Quantity", lambda x: x[x > 0].sum()),
    net_qty=("Quantity", "sum"),
    n_txn=("Quantity", "count"),
    n_sku=("ItemCode", "nunique"),
).reset_index()
daily["net_qty"] = daily["net_qty"].clip(lower=0)

start = train["Date"].min().normalize()
end = train["Date"].max().normalize()
all_dates = pd.date_range(start, end, freq="D")
tx_set = set(daily["Date"].dt.normalize())

cal = build_holiday_lookup(start, end)
cal = cal.merge(daily, on="Date", how="left")
cal["has_transactions"] = cal["Date"].isin(tx_set).astype(int)
cal["gross_qty"] = cal["gross_qty"].fillna(0)
cal["net_qty"] = cal["net_qty"].fillna(0)
cal["n_txn"] = cal["n_txn"].fillna(0).astype(int)
cal["n_sku"] = cal["n_sku"].fillna(0).astype(int)

legacy_h = legacy_all_holidays_index()
cal["in_legacy_ALL_HOLIDAYS"] = cal["Date"].isin(legacy_h).astype(int)

# DOW baseline (post-2022, days with tx)
post = cal[(cal["Date"] >= "2022-01-01") & (cal["has_transactions"] == 1)]
dow_median = post.groupby("dayofweek")["gross_qty"].median().to_dict()
cal["dow_median_gross_post2022"] = cal["dayofweek"].map(dow_median)
cal["vs_dow_median_ratio"] = np.where(
    cal["dow_median_gross_post2022"] > 0,
    cal["gross_qty"] / cal["dow_median_gross_post2022"],
    0,
)

# Primary classification
def classify_row(r) -> str:
    if r["has_transactions"] == 0:
        if r["is_sunday"]:
            return "MISSING_SUNDAY_CLOSED"
        if r["is_tet"]:
            return "MISSING_TET_WINDOW"
        if r["is_vn_public"] or r["in_legacy_ALL_HOLIDAYS"]:
            return "MISSING_VN_PUBLIC_HOLIDAY"
        if r["is_intl"]:
            return "MISSING_INTL_OBSERVANCE"
        if r["is_saturday"]:
            return "MISSING_SATURDAY_NO_TXN"
        if "PRE_BUSINESS" in str(r["holiday_tags"]):
            return "MISSING_PRE_BUSINESS_RAMPUP"
        if "BRIDGE" in str(r["holiday_tags"]):
            return "MISSING_VN_BRIDGE_DAY"
        if r["holiday_tags"]:
            return "MISSING_TAGGED_NON_SUNDAY"
        return "MISSING_UNKNOWN"
    # has transactions
    if r["is_sunday"] and r["gross_qty"] < 50:
        return "LOW_VOLUME_SUNDAY_RARE_OPEN"
    if r["vs_dow_median_ratio"] < 0.15 and r["gross_qty"] > 0:
        return "LOW_VOLUME_VS_DOW"
    if r["vs_dow_median_ratio"] < 0.05:
        return "NEAR_ZERO_VOLUME"
    if r["is_tet"]:
        return "TET_PARTIAL_OPEN"
    if r["is_vn_public"]:
        return "HOLIDAY_PARTIAL_OPEN"
    return "NORMAL_TRADING"


cal["classification"] = cal.apply(classify_row, axis=1)

# Suggested new holidays: missing non-sunday not in legacy
missing = cal[cal["has_transactions"] == 0].copy()
missing_ns = missing[~missing["is_sunday"].astype(bool)]
new_holiday_candidates = missing_ns[missing_ns["in_legacy_ALL_HOLIDAYS"] == 0][
    ["Date", "dow_name", "holiday_tags", "classification"]
].sort_values("Date")

# Save outputs
out_all = EDA_DIR / "calendar_all_days.csv"
out_missing = EDA_DIR / "missing_days_classified.csv"
out_low = EDA_DIR / "abnormal_low_volume_days.csv"
out_candidates = EDA_DIR / "new_holiday_candidates.csv"

cal.to_csv(out_all, index=False)
missing.to_csv(out_missing, index=False)
cal[cal["classification"].str.startswith("LOW") | cal["classification"].str.startswith("NEAR")].to_csv(
    out_low, index=False
)
new_holiday_candidates.to_csv(out_candidates, index=False)

# Summary stats
print(f"\nCalendar span: {start.date()} → {end.date()} ({len(cal)} days)")
print(f"Days with transactions: {cal['has_transactions'].sum()}")
print(f"Missing days (no txn): {(cal['has_transactions']==0).sum()}")
print("\nMissing breakdown:")
print(missing.groupby("classification").size().sort_values(ascending=False).to_string())
print("\nLow/abnormal volume (has txn):")
low = cal[cal["classification"].str.contains("LOW|NEAR|TET_PARTIAL|HOLIDAY_PARTIAL")]
print(low.groupby("classification").size().sort_values(ascending=False).head(15).to_string())
print(f"\nNon-Sunday missing NOT in legacy ALL_HOLIDAYS: {len(new_holiday_candidates)}")
print(f"  → {out_candidates}")

# Chart: missing by classification
fig, ax = plt.subplots(figsize=(10, 5))
miss_counts = missing["classification"].value_counts()
miss_counts.plot(kind="barh", ax=ax, color="#c0392b")
ax.set_title("Missing days by classification (343 total)")
plt.tight_layout()
plt.savefig(EDA_DIR / "19_missing_days_by_class.png", dpi=200)
plt.close()

# Chart: calendar heatmap has_tx by year-month
cal["ym"] = cal["Date"].dt.to_period("M")
pivot = cal.groupby(["ym", "dow_name"])["has_transactions"].mean().unstack(fill_value=0)
fig, ax = plt.subplots(figsize=(14, 8))
sns.heatmap(pivot, ax=ax, cmap="RdYlGn", vmin=0, vmax=1)
ax.set_title("Fraction of days WITH transactions by month × DOW")
plt.savefig(EDA_DIR / "20_tx_rate_month_dow.png", dpi=200)
plt.close()

# Markdown report
lines = [
    "# Full Calendar Audit — Every Day Classified\n",
    f"Span: **{start.date()}** to **{end.date()}** ({len(cal)} calendar days)\n\n",
    "## Summary\n\n",
    f"| Metric | Count |\n|--------|-------|\n",
    f"| Days with ≥1 transaction | {int(cal['has_transactions'].sum())} |\n",
    f"| Missing (no transaction row) | {int((cal['has_transactions']==0).sum())} |\n",
    f"| Missing Sundays | {int(missing['is_sunday'].sum())} |\n",
    f"| Missing non-Sunday | {int((~missing['is_sunday'].astype(bool)).sum())} |\n",
    f"| Missing non-Sun NOT in legacy `ALL_HOLIDAYS` | {len(new_holiday_candidates)} |\n",
    f"| Low/near-zero volume (has txn) | {len(low)} |\n\n",
    "## Missing day classification\n\n",
    "| Class | Count | Meaning |\n|-------|-------|--------|\n",
]
for cls, cnt in missing["classification"].value_counts().items():
    lines.append(f"| {cls} | {cnt} | see below |\n")

lines.extend(
    [
        "\n### Class definitions\n\n",
        "- **MISSING_SUNDAY_CLOSED**: Sunday, no txn — business closed (expected).\n",
        "- **MISSING_TET_WINDOW**: Inside Tet multi-day window, no txn.\n",
        "- **MISSING_VN_PUBLIC_HOLIDAY**: VN public holiday (fixed or Hung Kings), no txn.\n",
        "- **MISSING_INTL_OBSERVANCE**: Christmas / NYE / etc., no txn.\n",
        "- **MISSING_SATURDAY_NO_TXN**: Saturday without txn — investigate.\n",
        "- **MISSING_TAGGED_NON_SUNDAY**: Has holiday tag but not Sunday — bridge/special.\n",
        "- **MISSING_UNKNOWN**: No txn, not Sunday, not in holiday tables — **must review**.\n\n",
        "## Legacy `ALL_HOLIDAYS` gap\n\n",
        "Current code only marks: Tet (5 anchors), Jan 1, Apr 30, May 1, Sep 2 per year.\n",
        f"**{len(new_holiday_candidates)}** non-Sunday missing dates are **not** in legacy list → `eda_output/new_holiday_candidates.csv`.\n\n",
        "## Files\n\n",
        f"- `{out_all.name}` — all {len(cal)} days\n",
        f"- `{out_missing.name}` — missing only\n",
        f"- `{out_low.name}` — low volume anomalies\n",
        f"- `{out_candidates.name}` — dates to add to feature holidays\n",
        "- `19_missing_days_by_class.png`, `20_tx_rate_month_dow.png`\n",
    ]
)

# Appendix: every missing day listed
lines.append("\n## Appendix: all 343 missing days (complete list)\n\n")
lines.append("| Date | DOW | Classification | Tags | In legacy ALL_HOLIDAYS |\n")
lines.append("|------|-----|----------------|------|------------------------|\n")
for _, r in missing.sort_values("Date").iterrows():
    lines.append(
        f"| {r['Date'].strftime('%Y-%m-%d')} | {r['dow_name']} | {r['classification']} | "
        f"{r['holiday_tags'] or '-'} | {int(r['in_legacy_ALL_HOLIDAYS'])} |\n"
    )

(EDA_DIR / "CALENDAR_AUDIT_REPORT.md").write_text("".join(lines), encoding="utf-8")
print(f"\nSaved → {EDA_DIR / 'CALENDAR_AUDIT_REPORT.md'}")
print("Done.")
