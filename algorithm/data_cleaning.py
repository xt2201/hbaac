# data_cleaning.py
"""
Kiểm tra và làm sạch train.csv → train_cleaned.csv.

Các bước:
  1. Date      : parse YYYY-MM-DD → datetime
  2. Stt       : giữ nguyên string (có 2 dạng: số nguyên và tiền tố "T")
  3. Quantity  : ép về int
  4. UnitPrice : dấu phẩy thập phân → float  ('131818,1818' → 131818.1818)
  5. Unit Cost : dấu phẩy thập phân → float
  6. SalesAmount  : dấu phẩy thập phân → float (một số dòng có thập phân)
  7. Cost Amount  : dấu phẩy thập phân → float (8908 dòng có thập phân)
  8. Xóa dòng trùng lặp hoàn toàn
  9. Tách hàng trả lại (Quantity < 0) ra returns.csv

Chạy:
    python data_cleaning.py
"""

import pandas as pd

INPUT_CSV = "data/train.csv"
OUT_DIR   = "data"


def parse_decimal_comma(series: pd.Series) -> pd.Series:
    """Dấu phẩy thập phân → dấu chấm rồi ép float: '131818,1818' → 131818.1818"""
    return (series.astype(str)
                  .str.strip()
                  .str.replace(",", ".", regex=False)
                  .replace("nan", "0")
                  .astype(float))


def check_and_report(df_raw: pd.DataFrame):
    """In báo cáo kiểm tra kiểu dữ liệu từng cột."""
    print("\n── Kiểm tra kiểu dữ liệu ──────────────────────────────────")

    # Date
    bad_date = pd.to_datetime(df_raw["Date"], format="%Y-%m-%d", errors="coerce").isna().sum()
    print(f"  Date        : {'OK' if bad_date == 0 else f'SAI {bad_date} dòng'}")

    # Stt: số nguyên thuần hoặc tiền tố "T"
    mask_t   = df_raw["Stt"].astype(str).str.match(r"^T\d+$")
    mask_int = df_raw["Stt"].astype(str).str.match(r"^\d+$")
    n_bad_stt = (~mask_t & ~mask_int).sum()
    print(f"  Stt         : {mask_int.sum():,} dạng số nguyên | "
          f"{mask_t.sum():,} dạng T-prefix (sẽ bỏ 'T') | {n_bad_stt} dòng khác")

    # Quantity
    bad_qty = (~df_raw["Quantity"].astype(str).str.match(r"^-?\d+$")).sum()
    print(f"  Quantity    : {'OK' if bad_qty == 0 else f'SAI {bad_qty} dòng'}")

    # UnitPrice / Unit Cost — dấu phẩy thập phân
    for col in ["UnitPrice", "Unit Cost"]:
        n_comma = df_raw[col].astype(str).str.contains(",").sum()
        print(f"  {col:<12}: {n_comma:,} dòng dùng dấu phẩy thập phân → sẽ chuyển float")

    # SalesAmount
    bad_sa = (~df_raw["SalesAmount"].astype(str).str.match(r"^-?\d+$")).sum()
    print(f"  SalesAmount : {'OK int' if bad_sa == 0 else f'{bad_sa} dòng không phải int'}")

    # Cost Amount
    n_ca_comma = df_raw["Cost Amount"].astype(str).str.contains(",").sum()
    print(f"  Cost Amount : {n_ca_comma:,} dòng dùng dấu phẩy thập phân → sẽ chuyển float")
    print()


def clean(input_path: str, out_dir: str = OUT_DIR):
    print(f"Đọc {input_path} ...")
    df = pd.read_csv(input_path, dtype=str, low_memory=False)
    print(f"  Tổng dòng ban đầu : {len(df):,}")

    check_and_report(df)

    # ── 1. Date → datetime ────────────────────────────────────────────────
    df["Date"] = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors="coerce")

    # ── 2. Stt: bỏ tiền tố "T" rồi ép int ───────────────────────────────
    df["Stt"] = (df["Stt"].astype(str)
                          .str.lstrip("T")
                          .pipe(pd.to_numeric, errors="coerce")
                          .fillna(0)
                          .astype(int))

    # ── 3. Quantity → int ────────────────────────────────────────────────
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0).astype(int)

    # ── 4–7. Cột tiền: dấu phẩy → dấu chấm → float ───────────────────────
    for col in ["UnitPrice", "Unit Cost", "SalesAmount", "Cost Amount"]:
        df[col] = parse_decimal_comma(df[col])

    # ── 8. Xóa dòng trùng lặp ────────────────────────────────────────────
    n_dup = df.duplicated().sum()
    df = df.drop_duplicates()
    print(f"  Xóa {n_dup:,} dòng trùng lặp → còn {len(df):,} dòng")

    # ── 9. Tách hàng trả lại ─────────────────────────────────────────────
    is_return  = (df["Quantity"] < 0) & (df["SalesAmount"] < 0)
    returns_df = df[is_return].copy()
    sales_df   = df[~is_return].copy()
    sales_df["Quantity"] = sales_df["Quantity"].clip(lower=0)
    print(f"  Hàng trả lại  : {len(returns_df):,} dòng → {out_dir}/returns.csv")
    print(f"  Hàng bán hàng : {len(sales_df):,} dòng → {out_dir}/train_cleaned.csv")

    # ── Lưu ──────────────────────────────────────────────────────────────
    sales_df.to_csv(f"{out_dir}/train_cleaned.csv",  index=False)
    returns_df.to_csv(f"{out_dir}/returns.csv",       index=False)

    # ── Kiểm tra kiểu sau khi làm sạch ───────────────────────────────────
    print("\n── Dtypes sau khi làm sạch ─────────────────────────────────")
    print(sales_df.dtypes)
    print()
    print("── Thống kê các cột số ─────────────────────────────────────")
    print(sales_df[["Quantity", "UnitPrice", "SalesAmount",
                    "Unit Cost", "Cost Amount"]].describe().round(2))


if __name__ == "__main__":
    clean(INPUT_CSV)
