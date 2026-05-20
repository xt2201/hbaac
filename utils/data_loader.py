# utils/data_loader.py
"""
Load, parse và preprocess train.csv + sample_submission.csv.
Trả về:
  series          : np.ndarray (N_skus, T)  — daily quantity matrix
  all_skus        : list[str]               — SKU order khớp với submission
  submission_df   : pd.DataFrame            — template gốc
  profit_weights  : np.ndarray (N_skus,)    — normalized profit weight (≥ 0)
"""

import numpy as np
import pandas as pd
from configs.config import TRAIN_CSV, SUBMISSION_CSV


def _parse_vnd(series: pd.Series) -> pd.Series:
    """Parse VND string '1,234,567' → float. Handles NaN gracefully."""
    return (series.astype(str)
                  .str.replace(",", "", regex=False)
                  .str.strip()
                  .replace("nan", "0")
                  .astype(float))


def load_data(verbose: bool = True):
    if verbose:
        print("Loading train.csv ...")
    train_df   = pd.read_csv(TRAIN_CSV, parse_dates=["Date"])
    submission = pd.read_csv(SUBMISSION_CSV)

    # ── Parse money columns (stored as VND strings) ───────────────────────
    train_df["UnitPrice"]    = _parse_vnd(train_df["UnitPrice"])
    train_df["Unit Cost"]    = _parse_vnd(train_df["Unit Cost"])
    train_df["SalesAmount"]  = _parse_vnd(train_df["SalesAmount"])
    train_df["Cost Amount"]  = _parse_vnd(train_df["Cost Amount"])

    # ── Profit per SKU (use ALL transactions incl. returns) ──────────────
    # Returns DO reduce profit → SKU with many returns gets lower weight,
    # which is realistic for importance ranking.
    train_df["Profit"] = train_df["SalesAmount"] - train_df["Cost Amount"]
    profit_by_sku = (train_df.groupby("ItemCode")["Profit"]
                              .sum()
                              .reset_index()
                              .rename(columns={"Profit": "profit_i"}))

    # ── Filter out return transactions BEFORE aggregating demand ─────────
    # Returns = (Quantity, SalesAmount, Cost Amount) all negative.
    # Demand forecasting should predict future SALES, not net (sales-returns).
    is_return = ((train_df["Quantity"]    < 0) &
                 (train_df["SalesAmount"] < 0) &
                 (train_df["Cost Amount"] < 0))
    n_returns = int(is_return.sum())
    sales_df  = train_df[~is_return]

    # ── Daily quantity from sales-only rows ───────────────────────────────
    daily = (sales_df.groupby(["Date", "ItemCode"])["Quantity"]
                     .sum()
                     .reset_index())
    daily.columns = ["ds", "unique_id", "y"]
    daily["y"] = daily["y"].clip(lower=0).astype(np.float32)

    # ── Align to submission SKU list ──────────────────────────────────────
    all_skus = (submission["id"]
                .str.replace(r"_validation|_evaluation", "", regex=True)
                .unique())

    date_range = pd.date_range(daily["ds"].min(), daily["ds"].max(), freq="D")
    full_index = pd.MultiIndex.from_product(
        [all_skus, date_range], names=["unique_id", "ds"])
    daily = (daily.set_index(["unique_id", "ds"])
                  .reindex(full_index, fill_value=0)
                  .reset_index())
    daily["y"] = daily["y"].clip(lower=0).astype(np.float32)

    pivot  = daily.pivot(index="unique_id", columns="ds", values="y").loc[all_skus]
    series = np.ascontiguousarray(pivot.values.astype(np.float32))

    # ── Profit weights ────────────────────────────────────────────────────
    profit_map     = profit_by_sku.set_index("ItemCode")["profit_i"].to_dict()
    raw_weights    = np.array([max(profit_map.get(s, 0.0), 0.0) for s in all_skus],
                               dtype=np.float64)
    total          = raw_weights.sum()
    profit_weights = raw_weights / total if total > 0 else np.ones(len(all_skus)) / len(all_skus)

    if verbose:
        print(f"  Series matrix : {series.shape}")
        print(f"  Date range    : {pivot.columns.min().date()} → {pivot.columns.max().date()}")
        print(f"  Returns filtered : {n_returns:,} rows ({n_returns/len(train_df)*100:.2f}%)")
        print(f"  SKUs w/ profit> 0 : {(raw_weights > 0).sum()} / {len(all_skus)}")
        print(f"  Total profit  : {total:,.0f} VND")

    return series, list(all_skus), submission, profit_weights