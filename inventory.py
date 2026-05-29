# inventory.py
"""
Mô hình tồn kho EOQ (Economic Order Quantity) tối ưu theo tháng.

Chia forecast 56 ngày thành 2 tháng (28 ngày/tháng):
  - Tháng 1: ngày 1-28  (validation window)
  - Tháng 2: ngày 29-56 (evaluation window)

Cho mỗi tháng, tính EOQ dựa trên demand dự báo thực tế:
  D_annual_m  = D_monthly * (365 / 28)     (annualize để dùng công thức chuẩn)
  EOQ_m       = sqrt(2 * D_annual_m * S / H)
  Safety Stock = z * σ_d * sqrt(L)
  ROP          = d_bar_m * L + Safety Stock
  Order_Qty    = max(EOQ_m, D_m + Safety_Stock)   (đủ cover tháng + buffer)

Chạy:
    python3 inventory.py
    python3 inventory.py --forecast outputs/submission_nbeats.csv
    python3 inventory.py --train train.csv --output inventory_plan.csv
    python3 inventory.py --order-cost 300000 --holding-rate 0.25 --lead-time 14
"""

import argparse
import os
import numpy as np
import pandas as pd
from scipy.stats import norm

# ── Defaults ──────────────────────────────────────────────────────────────────
FORECAST_CSV   = "submission_nbeats.csv"
TRAIN_CSV      = "train.csv"
OUTPUT_CSV     = "inventory_plan.csv"
TRAIN_START    = "2022-01-01"
DAYS_PER_MONTH = 28   # = 1 HORIZON / 2

DEFAULT_ORDER_COST   = 200_000
DEFAULT_HOLDING_RATE = 0.20
DEFAULT_LEAD_TIME    = 7
DEFAULT_SERVICE_LVL  = 0.95


def load_forecast(path: str) -> pd.DataFrame:
    """Load submission CSV, ghép validation + evaluation thành 56-day forecast."""
    df = pd.read_csv(path)
    df["sku"]  = df["id"].str.replace(r"_(validation|evaluation)$", "", regex=True)
    df["type"] = df["id"].str.extract(r"_(validation|evaluation)$")[0]

    fc_cols = [f"F{i}" for i in range(1, 29)]
    val = df[df["type"] == "validation"][["sku"] + fc_cols].copy()
    eva = df[df["type"] == "evaluation"][["sku"] + fc_cols].copy()

    val.columns = ["sku"] + [f"d{i}"  for i in range(1, 29)]
    eva.columns = ["sku"] + [f"d{i}"  for i in range(29, 57)]

    return val.merge(eva, on="sku")


def load_unit_cost(train_csv: str) -> pd.DataFrame:
    """Tính unit cost trung bình và std demand ngày từ training data."""
    df = pd.read_csv(train_csv, dtype=str, low_memory=False)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df[df["Date"] >= TRAIN_START]

    df["Unit Cost"] = (df["Unit Cost"].astype(str)
                       .str.replace(",", ".", regex=False)
                       .replace("nan", "0")
                       .astype(float))
    df["Quantity"]  = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0)

    cost_avg = (df[df["Quantity"] > 0]
                .groupby("ItemCode")["Unit Cost"]
                .median()
                .reset_index()
                .rename(columns={"ItemCode": "sku", "Unit Cost": "unit_cost"}))

    daily = (df[df["Quantity"] > 0]
             .groupby(["Date", "ItemCode"])["Quantity"]
             .sum()
             .reset_index())
    std_demand = (daily.groupby("ItemCode")["Quantity"]
                  .std()
                  .fillna(0)
                  .reset_index()
                  .rename(columns={"ItemCode": "sku", "Quantity": "std_daily"}))

    return cost_avg.merge(std_demand, on="sku", how="left").fillna(0)


def compute_monthly_eoq(forecast: pd.DataFrame, cost_df: pd.DataFrame,
                        S: float, i: float, L: int,
                        service_level: float) -> pd.DataFrame:
    """
    Tính kế hoạch EOQ cho từng SKU × tháng.

    Trả về DataFrame dài (tidy): mỗi hàng = 1 SKU × 1 tháng.
    """
    months = {
        1: [f"d{j}" for j in range(1,  29)],
        2: [f"d{j}" for j in range(29, 57)],
    }

    base = forecast[["sku"]].merge(cost_df, on="sku", how="left")
    base["unit_cost"] = base["unit_cost"].fillna(0)
    base["std_daily"] = base["std_daily"].fillna(0)

    z = norm.ppf(service_level)
    H = (i * base["unit_cost"]).values        # VND/unit/year

    records = []
    for m, cols in months.items():
        D_month   = forecast[cols].sum(axis=1).values           # tổng cầu tháng
        d_bar     = D_month / DAYS_PER_MONTH                    # cầu ngày tb
        D_annual  = d_bar * 365                                  # annualize

        active = D_annual > 0

        eoq = np.where(
            active & (H > 0),
            np.sqrt(2 * D_annual * S / np.where(H > 0, H, 1.0)),
            0.0
        )

        safety_stock = np.where(active, z * base["std_daily"].values * np.sqrt(L), 0.0)
        rop          = np.where(active, d_bar * L + safety_stock, 0.0)
        cycle_time   = np.where(active & (eoq > 0),
                                  eoq / np.where(D_annual > 0, D_annual, 1.0) * 365, 0.0)

        # Số lượng đề nghị đặt: lấy max(EOQ, đủ cover cả tháng + safety stock)
        order_qty = np.where(
            active,
            np.maximum(np.ceil(eoq), np.ceil(D_month + safety_stock)),
            0.0
        )

        cost_ordering = np.where(active & (eoq > 0),
                                 (D_annual / np.where(eoq > 0, eoq, 1.0)) * S, 0.0)
        cost_holding  = np.where(active, (eoq / 2) * H, 0.0)
        cost_purchase = D_annual * base["unit_cost"].values
        total_cost    = cost_ordering + cost_holding + cost_purchase

        month_df = pd.DataFrame({
            "sku"                   : base["sku"].values,
            "month"                 : m,
            "unit_cost"             : base["unit_cost"].values,
            "std_daily"             : base["std_daily"].values,
            "D_month"               : D_month.round(1),
            "mean_daily"            : d_bar.round(2),
            "D_annual_equiv"        : D_annual.round(1),
            "EOQ"                   : np.ceil(eoq).astype(int),
            "Recommended_Order"     : order_qty.astype(int),
            "Safety_Stock"          : np.ceil(safety_stock).astype(int),
            "Reorder_Point"         : np.ceil(rop).astype(int),
            "Cycle_Time_days"       : cycle_time.round(1),
            "Annual_Order_Cost"     : cost_ordering.round(0),
            "Annual_Holding_Cost"   : cost_holding.round(0),
            "Annual_Purchase_Cost"  : cost_purchase.round(0),
            "Total_Annual_Cost"     : total_cost.round(0),
        })
        records.append(month_df)

    result = pd.concat(records, ignore_index=True)
    result = result.sort_values(["month", "D_month"], ascending=[True, False])
    return result


def print_summary(result: pd.DataFrame, S: float, i: float, L: int, sl: float):
    print(f"\n{'='*65}")
    print(f"  MÔ HÌNH TỒN KHO EOQ — KẾ HOẠCH THEO THÁNG")
    print(f"{'='*65}")
    print(f"  Chi phí đặt hàng  (S) : {S:,.0f} VND/lần")
    print(f"  Tỷ lệ giữ hàng    (i) : {i*100:.0f}% giá vốn/năm")
    print(f"  Lead time         (L) : {L} ngày")
    print(f"  Mức dịch vụ           : {sl*100:.0f}%  (z = {norm.ppf(sl):.3f})")
    print(f"{'='*65}")

    for m in [1, 2]:
        mdf    = result[result["month"] == m]
        active = mdf[mdf["D_month"] > 0]
        print(f"\n  ── THÁNG {m} (ngày {(m-1)*28+1}–{m*28}) {'─'*40}")
        print(f"  SKU cần đặt hàng    : {len(active):,}")
        print(f"  SKU không có nhu cầu: {(mdf['D_month']==0).sum():,}")
        print(f"  Tổng lượng đặt hàng : {active['Recommended_Order'].sum():,.0f} units")
        print(f"  TB Safety Stock/SKU : {active['Safety_Stock'].mean():.1f} units")
        print(f"  TB Cycle Time       : {active[active['Cycle_Time_days']>0]['Cycle_Time_days'].median():.1f} ngày")
        print(f"\n  Top 10 SKU nhu cầu cao nhất (Tháng {m}):")
        hdr = f"  {'SKU':<15} {'Cầu/tháng':>10} {'Cầu/ngày':>9} {'EOQ':>7} {'Đặt':>7} {'SS':>7} {'ROP':>7}"
        print(hdr)
        print(f"  {'-'*65}")
        for _, row in active.head(10).iterrows():
            print(f"  {row['sku']:<15} {row['D_month']:>10.1f} {row['mean_daily']:>9.2f} "
                  f"{row['EOQ']:>7,} {row['Recommended_Order']:>7,} "
                  f"{row['Safety_Stock']:>7,} {row['Reorder_Point']:>7,}")

    print(f"\n{'='*65}\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--forecast",      default=FORECAST_CSV)
    parser.add_argument("--train",         default=TRAIN_CSV)
    parser.add_argument("--output",        default=OUTPUT_CSV)
    parser.add_argument("--order-cost",    type=float, default=DEFAULT_ORDER_COST)
    parser.add_argument("--holding-rate",  type=float, default=DEFAULT_HOLDING_RATE)
    parser.add_argument("--lead-time",     type=int,   default=DEFAULT_LEAD_TIME)
    parser.add_argument("--service-level", type=float, default=DEFAULT_SERVICE_LVL)
    args = parser.parse_args()

    print(f"Loading forecast từ {args.forecast} ...")
    forecast = load_forecast(args.forecast)
    print(f"  {len(forecast):,} SKUs")

    print(f"Loading unit cost từ {args.train} ...")
    cost_df = load_unit_cost(args.train)

    print("Tính EOQ theo tháng ...")
    result = compute_monthly_eoq(forecast, cost_df,
                                 S=args.order_cost,
                                 i=args.holding_rate,
                                 L=args.lead_time,
                                 service_level=args.service_level)

    print_summary(result, args.order_cost, args.holding_rate,
                  args.lead_time, args.service_level)

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    result.to_csv(args.output, index=False)
    print(f"  Đã lưu → {args.output}")
    print(f"  Kích thước: {len(result):,} hàng ({len(result)//2:,} SKU × 2 tháng)\n")


if __name__ == "__main__":
    main()
