"""Shared V5 feature enrichment on feature_panel."""

import numpy as np
import pandas as pd

from config import TRAIN_END

TRAIN_END_TS = pd.Timestamp(TRAIN_END)

tet_dates = pd.to_datetime(
    ["2021-02-12", "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29"]
)
other_holidays = []
for y in range(2020, 2027):
    other_holidays.extend([f"{y}-01-01", f"{y}-04-30", f"{y}-05-01", f"{y}-09-02"])
ALL_HOLIDAYS = pd.Index(tet_dates.tolist() + pd.to_datetime(other_holidays).tolist())


def days_to_next_holiday(d: pd.Timestamp) -> int:
    fut = ALL_HOLIDAYS[ALL_HOLIDAYS >= d]
    return (fut.min() - d).days if len(fut) > 0 else 999


def days_since_holiday(d: pd.Timestamp) -> int:
    past = ALL_HOLIDAYS[ALL_HOLIDAYS <= d]
    return (d - past.max()).days if len(past) > 0 else 999


def is_pre_holiday(d: pd.Timestamp, lookahead: int = 2) -> int:
    for h in range(1, lookahead + 1):
        if (d + pd.Timedelta(days=h)) in ALL_HOLIDAYS:
            return 1
    return 0


def enrich_panel(fp: pd.DataFrame, sub_skus: list) -> pd.DataFrame:
    fp = fp.sort_values(["ItemCode", "Date"]).reset_index(drop=True)
    sku_cat_dtype = pd.CategoricalDtype(categories=sub_skus, ordered=False)

    fp["daily_price"] = np.where(fp["qty"] > 0, fp["sales_amount"] / fp["qty"], np.nan)
    fp["last_known_price"] = fp.groupby("ItemCode")["daily_price"].ffill().fillna(0)
    fp["price_lag1"] = fp.groupby("ItemCode")["last_known_price"].shift(1).astype(np.float32)
    fp.drop(columns=["daily_price", "last_known_price"], inplace=True)

    fp["ItemCode_cat"] = fp["ItemCode"].astype(sku_cat_dtype).cat.codes
    days_diff = (fp["Date"] - TRAIN_END_TS).dt.days
    fp["decay_weight"] = np.clip(np.exp(days_diff / 730.0), 0.1, 1.0)

    is_sale = (fp["qty"] > 0).astype(int)
    sale_blocks = is_sale.groupby(fp["ItemCode"]).cumsum()
    fp["days_since_last_sale"] = fp.groupby(["ItemCode", sale_blocks]).cumcount().astype(np.float32)
    fp["days_since_last_sale_lag1"] = (
        fp.groupby("ItemCode")["days_since_last_sale"].shift(1).fillna(0).astype(np.float32)
    )
    fp.drop(columns=["days_since_last_sale"], inplace=True)

    fp["is_holiday"] = fp["Date"].isin(ALL_HOLIDAYS).astype(np.int8)
    unique_dates = fp["Date"].unique()
    fp["days_to_next_holiday"] = fp["Date"].map(
        {d: days_to_next_holiday(d) for d in unique_dates}
    ).astype(np.int16)
    fp["days_since_holiday"] = fp["Date"].map(
        {d: days_since_holiday(d) for d in unique_dates}
    ).astype(np.int16)
    fp["is_pre_holiday"] = fp["Date"].map(
        {d: is_pre_holiday(d) for d in unique_dates}
    ).astype(np.int8)

    return fp


FEAT_COLS = [
    "ItemCode_cat",
    "price_lag1",
    "days_since_last_sale_lag1",
    "return_rate_28d",
    "txn_count_log",
    "is_holiday",
    "days_to_next_holiday",
    "days_since_holiday",
    "is_pre_holiday",
    "dayofweek",
    "dayofmonth",
    "month",
    "quarter",
    "dayofyear",
    "weekofyear",
    "year",
    "is_weekend",
    "is_saturday",
    "is_sunday",
    "is_october",
    "is_month_end",
    "is_month_start",
    "trend",
    "sin_month",
    "cos_month",
    "sin_dow",
    "cos_dow",
    "sku_mean",
    "sku_std",
    "sku_median",
    "sku_max",
    "sku_p90",
    "sku_active_rate",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_7",
    "lag_14",
    "lag_21",
    "lag_28",
    "lag_35",
    "lag_42",
    "lag_56",
    "lag_364",
    "roll_mean_7",
    "roll_std_7",
    "roll_max_7",
    "roll_median_7",
    "roll_mean_14",
    "roll_std_14",
    "roll_max_14",
    "roll_median_14",
    "roll_mean_28",
    "roll_std_28",
    "roll_max_28",
    "roll_median_28",
    "roll_mean_56",
    "roll_std_56",
    "roll_max_56",
    "roll_median_56",
    "expand_mean",
]
