"""V6 feature column definitions (extends V5)."""

from v5_features import FEAT_COLS as FEAT_COLS_V5

FEAT_COLS_V6_EXTRA = [
    "global_qty_index",
    "same_dow_mean_4w",
    "days_to_october",
    "price_pct_change_28d",
    "margin_pct",
    "gross_qty_lag1",
    "expected_return_28d",
]

FEAT_COLS_V6 = FEAT_COLS_V5 + FEAT_COLS_V6_EXTRA

FEAT_COLS_DIRECT = FEAT_COLS_V6 + [
    "horizon",
    "horizon_sin",
    "horizon_cos",
    "is_private_horizon",
]
