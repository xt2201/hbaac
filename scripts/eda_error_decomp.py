"""
WRMSSE error decomposition by tier, DOW, and horizon bucket.
Uses V5/V6 holdout preds if available in processed/.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import DATA_DIR, HORIZON, PROC_DIR, TAIL_TXN_MAX, TOP_TIER_N, TRAIN_END
from eval_wrmsse import compute_wrmsse, eval_horizon_buckets, load_sku_weights, print_horizon_report

TRAIN_END_TS = pd.Timestamp(TRAIN_END)


def load_daily_qty(sub_skus: list) -> pd.DataFrame:
    train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
    train["Date"] = pd.to_datetime(train["Date"])
    train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0)
    daily = (
        train.groupby(["Date", "ItemCode"])["Quantity"]
        .sum()
        .reset_index()
        .pivot(index="Date", columns="ItemCode", values="Quantity")
        .fillna(0)
    )
    all_dates = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    daily = daily.reindex(all_dates, fill_value=0)
    for s in sub_skus:
        if s not in daily.columns:
            daily[s] = 0
    return daily[sub_skus]


def wrmsse_by_mask(
    preds_56: np.ndarray,
    daily_qty: pd.DataFrame,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    sku_mask: np.ndarray,
    anchor: pd.Timestamp,
) -> float:
    idx = np.where(sku_mask)[0]
    if len(idx) == 0:
        return float("nan")
    sub_list = [sub_skus[i] for i in idx]
    y_true, y_pred, weights, denoms = [], [], [], []
    for j, i in enumerate(idx):
        sku = sub_skus[i]
        w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0
        d = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
        weights.append(w)
        denoms.append(d)
        yt, yp = [], []
        for h in range(1, HORIZON + 1):
            dte = anchor + pd.Timedelta(days=h)
            yt.append(float(daily_qty.loc[dte, sku]) if dte in daily_qty.index else 0.0)
            yp.append(float(preds_56[i, h - 1]))
        y_true.append(yt)
        y_pred.append(yp)
    return compute_wrmsse(
        np.array(y_true), np.array(y_pred), np.array(weights), np.array(denoms)
    )


def main():
    sample = pd.read_csv(DATA_DIR / "sample_submission.csv")
    sub_skus = sorted(
        sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
    )
    sku_weights = load_sku_weights()
    daily_qty = load_daily_qty(sub_skus)

    txn = pd.read_csv(DATA_DIR / "train.csv", usecols=["ItemCode"]).groupby("ItemCode").size()
    top_set = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)
    tier_top = np.array([s in top_set for s in sub_skus])
    tier_tail = np.array([txn.get(s, 0) <= TAIL_TXN_MAX for s in sub_skus])
    tier_mid = ~(tier_top | tier_tail)

    pred_files = {
        "recursive": PROC_DIR / "recursive_56.npy",
        "direct": PROC_DIR / "direct_56.npy",
        "v6_final": PROC_DIR / "final_56.npy",
    }
    found = {k: p for k, p in pred_files.items() if p.exists()}
    if not found:
        print("No pred arrays in processed/. Run forecaster_v6.py first.")
        print("  Expected: recursive_56.npy, direct_56.npy, or final_56.npy")
        return

    lines = ["# WRMSSE Error Decomposition\n", f"Anchor: {TRAIN_END} + h=1..56\n\n"]
    for name, path in found.items():
        preds = np.load(path)
        lines.append(f"## {name} (`{path.name}`)\n\n")
        report = eval_horizon_buckets(daily_qty, preds, sub_skus, sku_weights, TRAIN_END_TS)
        for k, v in report.items():
            lines.append(f"- **{k}**: {v:.6f}\n")

        lines.append("\n### By tier\n\n")
        for tier_name, mask in [("top50", tier_top), ("mid", tier_mid), ("tail", tier_tail)]:
            s = wrmsse_by_mask(preds, daily_qty, sub_skus, sku_weights, mask, TRAIN_END_TS)
            lines.append(f"- {tier_name}: {s:.6f}\n")

        lines.append("\n### By DOW (holdout days)\n\n")
        holdout_dates = pd.date_range(TRAIN_END_TS + pd.Timedelta(days=1), periods=28, freq="D")
        for dow in range(7):
            day_mask_dates = [d for d in holdout_dates if d.dayofweek == dow]
            if not day_mask_dates:
                continue
            # approximate: score SKUs on those horizon days only
            sub_report = []
            for d in day_mask_dates:
                h = (d - TRAIN_END_TS).days
                if 1 <= h <= HORIZON:
                    rep = eval_horizon_buckets(
                        daily_qty, preds, sub_skus, sku_weights, TRAIN_END_TS, [h]
                    )
                    sub_report.append(rep["all"])
            avg = np.mean(sub_report) if sub_report else float("nan")
            dow_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow]
            lines.append(f"- {dow_name}: {avg:.6f}\n")
        lines.append("\n")

    out = ROOT / "eda_output" / "ERROR_DECOMP.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("".join(lines), encoding="utf-8")
    print(f"Saved → {out}")
    for name, path in found.items():
        preds = np.load(path)
        print(f"\n=== {name} ===")
        print_horizon_report(
            eval_horizon_buckets(daily_qty, preds, sub_skus, sku_weights, TRAIN_END_TS),
            prefix="",
        )


if __name__ == "__main__":
    main()
