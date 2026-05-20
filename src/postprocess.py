"""Forecast post-processing (tiered shrink, blend, caps, Sunday zero)."""

import numpy as np

from config import (
    MAGIC_MULT_DEFAULT,
    MAGIC_MULT_TAIL,
    MAGIC_MULT_TOP_TIER,
    P90_CAP_MULT,
    TAIL_BLEND_ALPHA,
)


def apply_postprocess(
    pred: np.ndarray,
    dow: int,
    tier_top: np.ndarray,
    tier_tail: np.ndarray,
    magic_mult_arr: np.ndarray,
    dow_naive_row: np.ndarray,
    sku_p90: np.ndarray,
    top_bias: np.ndarray | None = None,
) -> np.ndarray:
    """In-place style post-process; returns clipped non-negative predictions."""
    out = pred.astype(np.float32, copy=True)
    out = out * magic_mult_arr

    if tier_tail.any():
        out[tier_tail] = (
            TAIL_BLEND_ALPHA * out[tier_tail]
            + (1.0 - TAIL_BLEND_ALPHA) * dow_naive_row[tier_tail]
        )

    if top_bias is not None and tier_top.any():
        out[tier_top] = out[tier_top] + top_bias[tier_top]

    cap = sku_p90 * P90_CAP_MULT
    out = np.where(tier_top, out, np.minimum(out, cap))
    out = np.clip(out, 0, None)

    if dow == 6:
        out[:] = 0.0

    return out


def build_magic_mult_array(
    n: int,
    tier_top: np.ndarray,
    tier_tail: np.ndarray,
) -> np.ndarray:
    arr = np.full(n, MAGIC_MULT_DEFAULT, dtype=np.float32)
    arr[tier_top] = MAGIC_MULT_TOP_TIER
    arr[tier_tail] = MAGIC_MULT_TAIL
    return arr
