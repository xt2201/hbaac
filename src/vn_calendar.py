"""
Vietnam + international calendar reference for HBAAC EDA (2020-2026).
Sources: timeanddate.com, government announcements, lunar Tet windows.
"""

from __future__ import annotations

import pandas as pd

# ─── Fixed annual (solar) ─────────────────────────────────────────────────────
def fixed_vn_holidays(year: int) -> list[tuple[pd.Timestamp, str]]:
    return [
        (pd.Timestamp(year, 1, 1), "VN_NEW_YEAR"),
        (pd.Timestamp(year, 4, 30), "VN_REUNIFICATION_DAY"),
        (pd.Timestamp(year, 5, 1), "VN_LABOR_DAY"),
        (pd.Timestamp(year, 9, 2), "VN_NATIONAL_DAY"),
    ]


def fixed_international(year: int) -> list[tuple[pd.Timestamp, str]]:
    """Days some distributors close or run skeleton crew."""
    out = [
        (pd.Timestamp(year, 12, 25), "INTL_CHRISTMAS"),
        (pd.Timestamp(year, 12, 31), "INTL_NEW_YEAR_EVE"),
    ]
    if year >= 2020:
        out.append((pd.Timestamp(year, 3, 8), "INTL_WOMENS_DAY"))
    return out


# Tet + adjacent public closure (inclusive ranges)
TET_WINDOWS: list[tuple[str, str, str]] = [
    ("2020-01-23", "2020-01-30", "VN_TET_2020"),
    ("2021-01-29", "2021-02-16", "VN_TET_2021"),  # extended (gov + bridge)
    ("2022-01-29", "2022-02-06", "VN_TET_2022"),
    ("2023-01-20", "2023-01-26", "VN_TET_2023"),
    ("2024-02-07", "2024-02-14", "VN_TET_2024"),  # includes 7-Feb bridge
    ("2025-01-25", "2025-02-02", "VN_TET_2025"),
]

# Bridge / compensatory days (nghỉ bù) common in VN public sector
BRIDGE_DAYS: list[tuple[str, str]] = [
    ("2022-05-02", "VN_BRIDGE_LABOR_2022"),  # May 1 was Sunday
    ("2023-05-02", "VN_BRIDGE_LABOR_2023"),
    ("2023-09-01", "VN_BRIDGE_BEFORE_NATIONAL_2023"),
    ("2024-05-03", "VN_BRIDGE_LABOR_2024"),  # May 1-2 weekend pattern
    ("2025-05-02", "VN_BRIDGE_LABOR_2025"),
    ("2025-09-01", "VN_BRIDGE_BEFORE_NATIONAL_2025"),
]

# Pre-scale business (very early dataset — distributor ramp-up)
PRE_BUSINESS_CLOSURE = [
    ("2020-11-17", "2020-11-30", "PRE_BUSINESS_RAMPUP"),
]

# Hung Kings (10/3 lunar — solar dates per year)
HUNG_KINGS = {
    2020: "2020-04-02",
    2021: "2021-04-21",
    2022: "2022-04-11",
    2023: "2023-04-29",
    2024: "2024-04-18",
    2025: "2025-04-07",
}

# COVID / exceptional closure hints (optional tags)
EXCEPTIONAL_CLOSURE = [
    ("2020-04-01", "2020-04-22", "COVID_LOCKDOWN_HINT_2020"),
    ("2021-07-09", "2021-09-15", "COVID_HCMC_HINT_2021"),  # partial, tag only
]


def _expand_ranges(ranges: list[tuple[str, str, str]]) -> dict[pd.Timestamp, str]:
    out: dict[pd.Timestamp, str] = {}
    for start, end, label in ranges:
        for d in pd.date_range(start, end, freq="D"):
            out[d.normalize()] = label
    return out


def build_holiday_lookup(start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Every date in [start,end] with holiday tags (pipe-separated if multiple)."""
    dates = pd.date_range(start, end, freq="D")
    rows = []
    tet_map = _expand_ranges(TET_WINDOWS)
    exc_map = _expand_ranges(EXCEPTIONAL_CLOSURE)
    pre_map = _expand_ranges(PRE_BUSINESS_CLOSURE)
    bridge_map = {pd.Timestamp(k): v for k, v in BRIDGE_DAYS}

    for d in dates:
        tags = []
        y = d.year
        if d.dayofweek == 6:
            tags.append("WEEKEND_SUNDAY")
        elif d.dayofweek == 5:
            tags.append("WEEKEND_SATURDAY")

        for ts, lab in fixed_vn_holidays(y):
            if d == ts:
                tags.append(lab)
        for ts, lab in fixed_international(y):
            if d == ts:
                tags.append(lab)
        if d in tet_map:
            tags.append(tet_map[d])
        if y in HUNG_KINGS and d == pd.Timestamp(HUNG_KINGS[y]):
            tags.append("VN_HUNG_KINGS")
        if d in exc_map:
            tags.append(exc_map[d])
        if d in pre_map:
            tags.append(pre_map[d])
        if d in bridge_map:
            tags.append(bridge_map[d])

        rows.append(
            {
                "Date": d,
                "dayofweek": d.dayofweek,
                "dow_name": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d.dayofweek],
                "holiday_tags": "|".join(tags) if tags else "",
                "is_sunday": int(d.dayofweek == 6),
                "is_saturday": int(d.dayofweek == 5),
                "is_vn_public": int(any(t.startswith("VN_") for t in tags)),
                "is_tet": int(any("TET" in t for t in tags)),
                "is_intl": int(any(t.startswith("INTL_") for t in tags)),
            }
        )
    return pd.DataFrame(rows)


def build_all_holidays_feature_dates() -> pd.DatetimeIndex:
    """
    Holiday dates for LGBM features (is_holiday, days_to_next, is_pre_holiday).
    Matches eda_output/proposed_ALL_HOLIDAYS_v2.csv (programmatic source of truth).
    Excludes ad-hoc single-day closures (e.g. 2021-03-11).
    """
    dates: list[pd.Timestamp] = []
    for y in range(2020, 2027):
        for ts, _ in fixed_vn_holidays(y) + fixed_international(y):
            dates.append(ts.normalize())
    dates.extend(_expand_ranges(TET_WINDOWS).keys())
    for dstr, _ in BRIDGE_DAYS:
        dates.append(pd.Timestamp(dstr).normalize())
    for dstr in HUNG_KINGS.values():
        dates.append(pd.Timestamp(dstr).normalize())
    for y in range(2020, 2022):
        for d in pd.date_range(f"{y}-12-20", f"{y}-12-31", freq="D"):
            if d.dayofweek < 6:
                dates.append(d.normalize())
    for d in pd.date_range("2021-01-02", "2021-01-28", freq="D"):
        if d.dayofweek < 6:
            dates.append(d.normalize())
    return pd.DatetimeIndex(sorted(set(dates)))


def legacy_all_holidays_index() -> pd.DatetimeIndex:
    """Pre-V5.1 holiday list (Tet anchors + 4 fixed days/year) for audit diffs."""
    tet_dates = pd.to_datetime(
        ["2021-02-12", "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29"]
    )
    other: list[str] = []
    for y in range(2020, 2027):
        other.extend([f"{y}-01-01", f"{y}-04-30", f"{y}-05-01", f"{y}-09-02"])
    return pd.DatetimeIndex(tet_dates.tolist() + pd.to_datetime(other).tolist())
