# Forecast Project — WRMSSE Competition

## Cấu trúc project

```
hbaac/
├── data/                    ← train.csv, sample_submission.csv, train_cleaned.csv
├── configs/
│   └── config.py            ← tất cả hằng số & hyperparameter defaults
├── utils/
│   ├── data_loader.py       ← load, parse, pivot data
│   ├── dataset.py           ← WindowDataset (PyTorch, profit-weighted sampling)
│   └── metrics.py           ← RMSSE, WRMSSE, print_score
├── models/
│   ├── base.py              ← BaseForecaster interface
│   ├── nhits.py             ← N-HiTS
│   ├── nbeats.py            ← N-BEATS (model mặc định)
│   ├── tft.py               ← Temporal Fusion Transformer (lite)
│   └── dlinear.py           ← DLinear (linear baseline)
├── train.py                 ← train một model cụ thể
├── optuna_search.py         ← hyperparameter search
├── predict.py               ← tạo submission từ checkpoint
├── data_cleaning.py         ← làm sạch train.csv → train_cleaned.csv
└── eda.py                   ← exploratory data analysis → outputs/eda/
```

---

## Cài đặt

```bash
python3 -m venv venv
source venv/bin/activate
pip install torch optuna pandas numpy matplotlib seaborn
```

---

## Workflow

### 1. Làm sạch dữ liệu
```bash
python data_cleaning.py
# Output: data/train_cleaned.csv, data/returns.csv
```

### 2. Khám phá dữ liệu
```bash
python eda.py
# Output: outputs/eda/*.png  (9 biểu đồ)
```

### 3. Optuna hyperparameter search
```bash
python optuna_search.py --model nbeats --trials 50
python optuna_search.py --model all --trials 30   # so sánh tất cả models
```

### 4. Train model tốt nhất
```bash
python train.py --model nbeats --steps 2000
python train.py --model nbeats --params checkpoints/nbeats_best_params.json
```

### 5. Tạo submission
```bash
python predict.py --model nbeats --ensemble 3
# Output: outputs/submission_nbeats.csv
```

---

## Metric: WRMSSE

```
RMSSE_i = sqrt( mean_h(forecast_error²) / mean_{n-1}(naive_diff²) )
WRMSSE  = Σ_i  w_i × RMSSE_i
w_i     = max(profit_i, 0) / Σ_j max(profit_j, 0)
```

- **WRMSSE < 1** → tốt hơn naive baseline
- **WRMSSE = 1** → ngang naive (predict Y_{t-1})
- `profit_i = Σ_train (SalesAmount − CostAmount)` — tính trên toàn training set

---

## Phân tích EDA & Chiến lược Training

> Toàn bộ biểu đồ tại `outputs/eda/`. Dưới đây là các insight quan trọng và quyết định thiết kế tương ứng.

---

### 1. Structural Break cuối 2021

**Quan sát:** `02_daily_quantity.png` — volume tăng đột biến 6–7× từ cuối 2021 sang đầu 2022. Dữ liệu pre-2022 có scale và pattern hoàn toàn khác.

**Rủi ro:** Nếu train trên toàn bộ data, model sẽ học "trend tăng từ 0 lên" như một pattern, làm nhiễu dự báo tương lai.

**Quyết định:** Cắt data, chỉ train từ `2022-01-01` trở đi.
```python
# configs/config.py
TRAIN_START_DATE = "2022-01-01"
```

---

### 2. Weekly Seasonality rất mạnh (Sunday Effect)

**Quan sát:** `05_seasonality.png` — Chủ nhật có lượng bán trung bình **~6× cao hơn** các ngày trong tuần (23 vs ~4 units). Đây là signal mạnh nhất trong data.

**Rủi ro:** INPUT_SIZE không phải bội số 7 → sliding window cắt lệch vào ngày trong tuần → model học sai chu kỳ.

**Quyết định:**
- `INPUT_SIZE = 182` (26 tuần, bội số 7, thay vì 180)
- N-BEATS `n_harmonics = 6` để SeasonBlock bắt được chu kỳ 7, 14, 28 ngày
- Optuna tìm `n_harmonics` trong `[4, 12]` (tối thiểu 4 để không bỏ sót weekly cycle)

---

### 3. Phân phối Quantity cực kỳ right-skewed

**Quan sát:** `04_quantity_distribution.png` — Median = 1, p75 = 2, nhưng max > 5000. Phần lớn giao dịch bán 1–2 đơn vị.

**Rủi ro:** MSE loss bị dominate bởi các outlier spike → model tập trung vào số ít đơn hàng lớn, bỏ qua pattern phổ biến.

**Quyết định:**
- Giữ `loss = "mae"` làm default (MAE ít nhạy với outlier hơn MSE)
- Loại MSE khỏi Optuna search, chỉ tìm trong `["mae", "huber"]`

---

### 4. Extreme Sparsity — Đa số SKU gần như không có data

**Quan sát:** `07_sku_activity.png` — Median sparsity = **100%**. Hơn 12,000/15,972 SKU chỉ active dưới 20 ngày trong ~5 năm. Phần lớn series là all-zeros.

**Rủi ro:** Model lãng phí capacity vào các SKU zero, RMSSE denominator = 0 khi SKU không có bất kỳ biến động nào.

**Quyết định:**
- **Profit-weighted sampling** trong `WindowDataset`: SKU ít profit = ít được sample
- SKU với ≤ 14 ngày active → `forecast = 0` trong `predict.py` (không đủ data để dự báo tin cậy)
- SKU với `profit < 0` → weight = 0 trong WRMSSE
- **RMSSE denominator = 0**: SKU có series phẳng toàn 0 → gán RMSSE = 0 thay vì dùng epsilon 1e-8 (tránh blow-up WRMSSE lên hàng chục)

> **Bug đã phát hiện:** Dùng `naive_mse = max(0, 1e-8)` làm WRMSSE = 28 thay vì ~0.7. SKU không hoạt động từ 2022 nhưng có profit từ 2020-2021 → weight > 0 nhưng denominator = 0 → RMSSE = triệu. Sửa bằng cách gán RMSSE = 0 cho SKU có denominator = 0.

---

### 5. Concentration ở Top SKU

**Quan sát:** `03_top20_skus.png` — SKU-00003 chiếm ~17 tỷ doanh thu (gấp đôi #2). Top 5 SKU chiếm phần lớn WRMSSE vì profit weight cao.

**Rủi ro:** Nếu model forecast tệt top 5 SKU → WRMSSE tăng mạnh dù 15,000 SKU còn lại dự đoán tốt.

**Quyết định:**
- Tăng `max_steps` lên `3000` trong Optuna search để model có thêm iteration fit SKU quan trọng
- Profit-weighted sampling đảm bảo top SKU được train nhiều hơn

---

### 6. Trend sau Structural Break

**Quan sát:** `01_monthly_revenue.png` — Sau 2022 lợi nhuận ổn định ~3-6 tỷ/tháng nhưng có biến động. Có xu hướng giảm nhẹ từ 2023.

**Quyết định:** Tăng `degree_of_poly = 4` (từ 3) trong N-BEATS TrendBlock để bắt polynomial trend phức tạp hơn.

---

### 7. Tỷ lệ Train/Val/Test

**Lý do không dùng 8/1/1 như ML thông thường:**
- Time series **không được shuffle** — phải theo thứ tự thời gian
- 8/1/1 = bỏ 268 ngày gần nhất (dữ liệu quan trọng nhất) ra khỏi training
- Khi submit thì train lại full data nhưng config đã tune trên 80% → phân phối lệch

**Quyết định:** `VAL = TEST = 56 ngày` (= 1 HORIZON), train trên 91.7% data
```
[TRAIN 1230 ngày (91.7%)] [VAL 56 ngày] [TEST 56 ngày]
                           ↑              ↑
                   tune Optuna      unbiased estimate
```

**Lý giải VAL WRMSSE < TEST WRMSSE (bình thường):**
- VAL ngay sau training → model có context gần nhất → dễ dự báo hơn
- TEST xa training hơn 56 ngày → uncertainty cao hơn
- Càng xa training, WRMSSE càng tăng — đây là quy luật tự nhiên

---

### 8. Profit Weights — tính trên Full Data

**Vấn đề:** Nếu tính profit chỉ từ 2022 → thiếu doanh thu 2020-2021 → weights lệch so với competition.

**Quyết định:** Tính profit trên **toàn bộ** 2020-2025 (trước khi trim), nhưng **series để train** vẫn chỉ từ 2022.
```python
# data_loader.py — tính profit TRƯỚC khi trim
profit_by_sku = train_df.groupby("ItemCode")["Profit"].sum()  # full data
train_df = train_df[train_df["Date"] >= TRAIN_START_DATE]     # trim sau
```

---

### 9. Đọc điểm WRMSSE đúng cách

```
WRMSSE = 0        → Hoàn hảo (không đạt được)
WRMSSE < 1.0      → Tốt hơn naive baseline ✓  ← cần đạt
WRMSSE = 1.0      → Bằng naive (predict = hôm qua)
WRMSSE > 1.0      → Tệ hơn naive ✗

Naive WRMSSE của dataset này ≈ 0.73
Competition score hiện tại    ≈ 0.50  (tốt hơn naive ~32%)
```

**RMSSE p50 ≈ 0** không có nghĩa model tốt — chỉ vì hơn 50% SKU là sparse (all-zeros, predict 0 = đúng). Nhìn vào **WRMSSE** và **RMSSE p90** mới phản ánh đúng chất lượng model.

---

### Tóm tắt thay đổi config

| Tham số | Trước | Sau | Lý do |
|---|---|---|---|
| Tham số | Trước | Sau | Lý do |
|---|---|---|---|
| `TRAIN_START_DATE` | *(không có)* | `"2022-01-01"` | Bỏ data pre-break |
| `INPUT_SIZE` | `180` | `182` | Bội số 7 (weekly alignment) |
| `VAL_STEPS` | `28` | `56` | = 1 HORIZON, đủ để tune |
| `TEST_STEPS` | *(không có)* | `56` | Unbiased estimate |
| `n_harmonics` default | `4` | `6` | Bắt 7/14/28 ngày |
| `degree_of_poly` default | `3` | `4` | Trend phức tạp hơn |
| `n_blocks` default | `3` | `4` | Capacity cao hơn |
| `SPARSE_SKU_MIN_DAYS` | *(không có)* | `14` | SKU ≤ 14 ngày → forecast = 0 |
| Optuna `n_harmonics` | `[2, 8]` | `[4, 12]` | Không dưới 4 |
| Optuna `max_steps` | `[500,1000,2000]` | `[500,1000,2000,3000]` | Train kỹ hơn |
| Optuna `loss` | `["mae","mse","huber"]` | `["mae","huber"]` | Loại MSE |
| RMSSE denominator=0 | `→ 1e-8` (bug) | `→ RMSSE=0` | Tránh blow-up WRMSSE |
| Profit weights | Từ 2022 | Full 2020-2025 | Khớp công thức competition |

---

## Models

| Model | Đặc điểm | Tốc độ |
|---|---|---|
| **N-BEATS** *(default)* | Basis expansion, interpretable (trend + seasonality + generic) | ⚡⚡ |
| **N-HiTS** | Multi-scale pooling, tốt cho intermittent demand | ⚡⚡ |
| **TFT-Lite** | Attention + LSTM, capacity cao nhất nhưng chậm | ⚡ |
| **DLinear** | Linear decomposition, baseline nhanh | ⚡⚡⚡ |
