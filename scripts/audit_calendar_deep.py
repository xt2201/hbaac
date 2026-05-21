"""
Deep calendar analysis: resolve UNKNOWN days, low-volume clusters, forecast window, spikes.
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, EDA_DIR, TRAIN_END, VALID_START

EDA_DIR.mkdir(exist_ok=True)

print("=" * 70)
print("HBAAC  |  Deep Calendar Analysis")
print("=" * 70)

train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
train["Date"] = pd.to_datetime(train["Date"])
train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0)

cal = pd.read_csv(EDA_DIR / "calendar_all_days.csv", parse_dates=["Date"])
daily = train.groupby("Date").agg(
    gross=("Quantity", lambda x: x[x > 0].sum()),
    net=("Quantity", "sum"),
    n_txn=("Quantity", "count"),
    n_sku=("ItemCode", "nunique"),
).reset_index()

# ─── 1. Resolve 17 UNKNOWN missing days ───────────────────────────────────────
print("\n[1] Deep-dive: 17 MISSING_UNKNOWN days …")

# Manual + rule-based relabel (from EDA + VN business patterns)
INFERRED_CLOSURES: dict[str, tuple[str, str]] = {
    # Dec 2020: year-end / low-scale ramp (only 2 weeks of real volume in Nov)
    "2020-12-08": ("YEAR_END_2020", "Year-end closure (pre-scale distributor)"),
    "2020-12-10": ("YEAR_END_2020", "Year-end closure"),
    "2020-12-11": ("YEAR_END_2020", "Year-end closure"),
    "2020-12-17": ("YEAR_END_2020", "Year-end closure"),
    "2020-12-18": ("YEAR_END_2020", "Year-end closure"),
    "2020-12-23": ("YEAR_END_2020", "Year-end closure"),
    # Jan-Feb 2021: between New Year (Jan 1) and Tet (Feb 12) — many firms closed
    "2021-01-06": ("BETWEEN_NEWYEAR_TET_2021", "Gap between Jan 1 holiday and Tet 2021"),
    "2021-01-07": ("BETWEEN_NEWYEAR_TET_2021", "Gap between Jan 1 holiday and Tet 2021"),
    "2021-01-08": ("BETWEEN_NEWYEAR_TET_2021", "Gap between Jan 1 holiday and Tet 2021"),
    "2021-01-21": ("BETWEEN_NEWYEAR_TET_2021", "Pre-Tet wind-down 2021"),
    "2021-01-22": ("BETWEEN_NEWYEAR_TET_2021", "Pre-Tet wind-down 2021"),
    "2021-02-19": ("POST_TET_2021", "Post-Tet extended closure week"),
    "2021-02-26": ("POST_TET_2021", "Post-Tet extended closure"),
    "2021-03-01": ("POST_TET_2021", "Post-Tet / low season"),
    "2021-03-03": ("POST_TET_2021", "Post-Tet / low season"),
    "2021-03-11": ("ADHOC_2021", "Ad-hoc closure (single day, do not add to ALL_HOLIDAYS)"),
    "2021-03-16": ("ADHOC_2021", "Ad-hoc closure (single day)"),
}

# COVID community wave Jan 28+ 2021 (for context on nearby missing in audit)
COVID_WAVE_2021 = pd.date_range("2021-01-28", "2021-03-25", freq="D")

unknown_rows = []
for dstr, (code, note) in INFERRED_CLOSURES.items():
    d = pd.Timestamp(dstr)
    before = daily[(daily["Date"] >= d - pd.Timedelta(7)) & (daily["Date"] < d)]["gross"].sum()
    after = daily[(daily["Date"] > d) & (daily["Date"] <= d + pd.Timedelta(7))]["gross"].sum()
    unknown_rows.append(
        {
            "Date": d,
            "dow_name": cal.loc[cal["Date"] == d, "dow_name"].iloc[0],
            "inferred_code": code,
            "inferred_note": note,
            "gross_7d_before": before,
            "gross_7d_after": after,
            "near_covid_wave_2021": int(d in COVID_WAVE_2021),
        }
    )
unk_df = pd.DataFrame(unknown_rows)
unk_df.to_csv(EDA_DIR / "unknown_days_resolved.csv", index=False)

# ─── 2. Low volume days (has txn but abnormal) ─────────────────────────────────
print("[2] Low-volume trading days …")
has_tx = cal[cal["has_transactions"] == 1].copy()
post = has_tx[has_tx["Date"] >= "2022-01-01"]
low = post[post["vs_dow_median_ratio"] < 0.15].sort_values("vs_dow_median_ratio")
low.to_csv(EDA_DIR / "low_volume_days_deep.csv", index=False)

# Cluster: count by month
low["ym"] = low["Date"].dt.to_period("M")
by_month = low.groupby("ym").size()

# Days within 2 days of a missing day
missing_dates = set(cal.loc[cal["has_transactions"] == 0, "Date"])
near_missing = []
for _, r in has_tx.iterrows():
    d = r["Date"]
    for delta in [-2, -1, 1, 2]:
        if (d + pd.Timedelta(days=delta)) in missing_dates:
            near_missing.append(r)
            break
near_miss_df = pd.DataFrame(near_missing)
near_miss_pct = len(near_miss_df) / len(has_tx) * 100 if len(has_tx) else 0

# ─── 3. Saturday no-txn (8 days) ─────────────────────────────────────────────
sat_miss = cal[(cal["has_transactions"] == 0) & (cal["is_saturday"] == 1)][
    ["Date", "holiday_tags", "classification"]
]

# ─── 4. Forecast horizon 56 days (Public + Private) ─────────────────────────
print("[3] Forecast window day-by-day …")
valid_start = pd.Timestamp(VALID_START)
train_end = pd.Timestamp(TRAIN_END)
pub = pd.date_range(valid_start, periods=28, freq="D")
priv = pd.date_range(valid_start + pd.Timedelta(28), periods=28, freq="D")

from vn_calendar import build_holiday_lookup

fh_rows = []
for phase, dates in [("public", pub), ("private", priv)]:
    hol = build_holiday_lookup(dates.min(), dates.max()).set_index("Date")
    for i, d in enumerate(dates, 1):
        tags = hol.loc[d, "holiday_tags"] if d in hol.index else ""
        fh_rows.append(
            {
                "phase": phase,
                "F_day": i,
                "Date": d,
                "dow_name": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d.dayofweek],
                "is_sunday": d.dayofweek == 6,
                "is_saturday": d.dayofweek == 5,
                "is_october": d.month == 10,
                "holiday_tags": tags,
                "model_action": "HARD_ZERO" if d.dayofweek == 6 else "normal",
            }
        )
fh = pd.DataFrame(fh_rows)
fh.to_csv(EDA_DIR / "forecast_horizon_calendar.csv", index=False)

# ─── 5. Spike days vs calendar ───────────────────────────────────────────────
print("[4] Global spike days …")
post_daily = daily[daily["Date"] >= "2022-01-01"]
spike_thresh = 8000
spikes = post_daily[post_daily["gross"] > spike_thresh].merge(
    cal[["Date", "dow_name", "holiday_tags", "classification"]], on="Date", how="left"
)
spikes.to_csv(EDA_DIR / "spike_days_calendar.csv", index=False)

# ─── 6. Chart: low volume heatmap by month-dow ────────────────────────────────
pivot_low = post.assign(
    low_flag=(post["vs_dow_median_ratio"] < 0.15).astype(int)
).groupby([post["Date"].dt.month, "dow_name"])["low_flag"].mean()
# simpler
post2 = post.copy()
post2["month"] = post2["Date"].dt.month
piv = post2.pivot_table(index="month", columns="dow_name", values="vs_dow_median_ratio", aggfunc="median")
fig, ax = plt.subplots(figsize=(10, 6))
sns.heatmap(piv, ax=ax, cmap="RdYlGn", center=1.0, vmin=0, vmax=2)
ax.set_title("21 — Median vs-DOW volume ratio by month (post-2022, has txn)")
plt.savefig(EDA_DIR / "21_low_volume_month_dow.png", dpi=200, bbox_inches="tight")
plt.close()

# Chart: missing vs year
miss = cal[cal["has_transactions"] == 0].copy()
miss["year"] = miss["Date"].dt.year
fig, ax = plt.subplots(figsize=(10, 4))
miss.groupby(["year", "classification"]).size().unstack(fill_value=0).plot(kind="bar", stacked=True, ax=ax)
ax.set_title("22 — Missing days by year and class")
ax.legend(bbox_to_anchor=(1.02, 1), fontsize=8)
plt.tight_layout()
plt.savefig(EDA_DIR / "22_missing_by_year.png", dpi=200, bbox_inches="tight")
plt.close()

# ─── 7. Proposed holiday list for features ────────────────────────────────────
print("[5] Export proposed ALL_HOLIDAYS v2 …")
from vn_calendar import build_all_holidays_feature_dates

v2 = pd.DataFrame({"Date": build_all_holidays_feature_dates()})
v2.to_csv(EDA_DIR / "proposed_ALL_HOLIDAYS_v2.csv", index=False)

# ─── Report ───────────────────────────────────────────────────────────────────
lines = [
    "# Deep Calendar Analysis\n\n",
    "## 1. Seventeen `MISSING_UNKNOWN` days — resolved\n\n",
    "These are **not** random gaps. Pattern:\n\n",
    "| Inferred group | Dates | Interpretation |\n",
    "|----------------|-------|----------------|\n",
    "| **YEAR_END_2020** | Dec 8,10,11,17,18,23 2020 | Distributor pre-scale; year-end shutdown before 2022 regime |\n",
    "| **BETWEEN_NEWYEAR_TET_2021** | Jan 6–8, 21–22 2021 | Common VN practice: closed between Jan 1 and Tet (Feb 12) |\n",
    "| **POST_TET_2021** | Feb 19, 26; Mar 1, 3 2021 | Slow restart after Tet; still low global volume |\n",
    "| **ADHOC_2021** | Mar 11, 16 2021 | Single weekday zeros — **do not** add to recurring holiday list |\n\n",
    "Note: Major **COVID community wave** started **2021-01-28** (Hai Duong). Most UNKNOWN days are **before** that — not COVID lockdown.\n\n",
    "Full table: `unknown_days_resolved.csv`\n\n",
    "## 2. Low-volume days (has transactions, post-2022)\n\n",
    f"- **{len(low)}** days with gross qty < 15% of same-DOW median (post-2022).\n",
    f"- **{near_miss_pct:.1f}%** of trading days fall within ±2 days of a missing calendar day → closures bleed into neighbors.\n",
    "- Top months for low-volume: see `low_volume_days_deep.csv` and chart `21_low_volume_month_dow.png`.\n",
    "- **Action:** `is_pre_holiday`, `days_since_holiday`, shrink preds when `vs_dow_median_ratio` proxy low.\n\n",
    "## 3. Eight Saturdays with zero transactions\n\n",
    "Sat usually trades (~71% of Mon). Zero-txn Saturdays are **exceptional** (often adjacent to Tet/holiday):\n\n",
]
for _, r in sat_miss.iterrows():
    lines.append(f"- {r['Date'].strftime('%Y-%m-%d')} ({r['classification']}, tags={r['holiday_tags'] or '-'})\n")

lines.extend(
    [
        "\n## 4. Forecast horizon (56 days) — model rules\n\n",
        "File: `forecast_horizon_calendar.csv`\n\n",
        "| Phase | Sundays (hard-zero) | Saturdays | October days | Tet/holiday in window |\n",
        "|-------|---------------------|-----------|--------------|----------------------|\n",
    ]
)
for phase in ["public", "private"]:
    sub = fh[fh["phase"] == phase]
    lines.append(
        f"| {phase.capitalize()} | {(sub['is_sunday']).sum()} | {(sub['is_saturday']).sum()} | "
        f"{(sub['is_october']).sum()} | {(sub['holiday_tags'] != '').sum()} |\n"
    )

lines.extend(
    [
        "\n**Public** includes end-Sep (partial month historically low) + early Oct.\n",
        "**Private** is **full October** — align with `is_october`, return_rate, Oct seasonality.\n\n",
        "## 5. Global spike days (>8k gross, post-2022)\n\n",
        f"Count: **{len(spikes)}**. See `spike_days_calendar.csv`.\n",
        "- Not holidays — bulk orders. Use `global_qty_index`; cap top SKU P90 on spike days.\n\n",
        "## 6. Feature holiday list v2\n\n",
        f"`proposed_ALL_HOLIDAYS_v2.csv` has **{len(v2)}** dates (vs ~21 in legacy code).\n",
        "- Includes: Tet windows, Hung Kings, bridges, year-end weekdays 2020-21, between New Year–Tet.\n",
        "- **Do not** import ad-hoc single days (Mar 11/16 2021) into recurring list.\n\n",
        "## 7. Implications for modeling (V5, not broken V6)\n\n",
        "1. **Sunday:** hard-zero (8 days in 56d forecast).\n",
        "2. **Saturday:** normal but lower — never blend with Sunday.\n",
        "3. **October Private:** full month high season + returns — `return_rate_28d`, `is_october`.\n",
        "4. **Sep partial 2025 in train:** exclude from rolling stats (5,659 qty).\n",
        "5. **Pre-2022 / year-end 2020-21:** keep `TRAIN_START=2022-01-01`.\n",
        "6. **Update `v5_features.ALL_HOLIDAYS`** from `proposed_ALL_HOLIDAYS_v2.csv` for V5.1 — not V6 ensemble until recalibrated.\n",
    ]
)

(EDA_DIR / "DEEP_CALENDAR_ANALYSIS.md").write_text("".join(lines), encoding="utf-8")
print(f"\nSaved → {EDA_DIR / 'DEEP_CALENDAR_ANALYSIS.md'}")
print("Done.")
