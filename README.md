# HBAAC: Vietnamese Auto Parts Demand Forecasting

This repository contains the codebase and models for predicting daily sales quantity for the next 56 days across roughly **15,972 SKUs** of a Vietnamese Auto Parts distributor, based on nearly 5 years of transaction history (2020-11-17 to 2025-09-05).

## 🎯 Goal
The core objective is to build a robust retail demand forecasting system:
* Capture seasonality, trend, and lifecycle for best-selling SKUs.
* Avoid over-predicting sparse/rare SKUs in the long tail.
* Handle return transactions (negative quantities) appropriately.
* Ensure all final SKU predictions for the 56-day forecast horizon are non-negative.

---

## 📊 Dataset Structure
The raw data is stored in the `dataset/` directory (ignored by git due to file size):
* **`train.csv`**: Detailed transaction history of **711,980 rows** (2020-11-17 → 2025-09-05). Each row represents a transaction line with details such as `ItemCode`, `Quantity`, `UnitPrice`, `SalesAmount`, `Unit Cost`, and `Cost Amount`.
* **`sample_submission.csv`**: Submission template containing **31,944 rows × 29 columns**. It lists two rows per SKU (`<SKU>_validation` for Public score and `<SKU>_evaluation` for Private score) each with 28 forecast columns `F1` to `F28`.

---

## 📈 Evaluation Metric: WRMSSE
Submissions are evaluated using the **Weighted Root Mean Squared Scaled Error (WRMSSE)**.
* **RMSSE** is computed per SKU, scaling the forecast error by the historical one-step naive baseline error of that SKU (called the `wrmsse_denominator`).
* **WRMSSE** aggregates individual RMSSEs using a profit-based weight. The weight for each SKU is its share of total profit over the training set.

---

## 🚀 Pipeline Overview: The "Grandmaster" Model (V4)

After identifying weaknesses in V2 and V3, this pipeline introduces **5 Kaggle Grandmaster optimizations** specifically tailored for M5-style WRMSSE forecasting:

1. **Price Dynamics**: Although we don't have explicit future prices, we reconstruct the `last_known_price` using `SalesAmount / Quantity`. Price shifts are a massive predictor of retail demand.
2. **Vietnamese Holidays**: Introduced explicit boolean flags and `days_to_next_holiday` tracking for Tết (Movable Lunar New Year), 30/4, 1/5, and 2/9.
3. **Categorical Entity Embeddings**: We feed `ItemCode` natively as a categorical feature to LightGBM. This replaces manual "categories" and lets the tree-splits learn the bias/intercept for each individual SKU directly.
4. **Time-Decay Weights**: 5 years of history is too long (Concept Drift). The model scales sample weights by $e^{(days\_diff / 730)}$, giving recent 2024-2025 data exponentially higher importance than 2020-2021 data, without throwing it away.
5. **Zero-Streak Magic Feature**: For highly intermittent items, the model tracks `days_since_last_sale`. This allows the tree to learn the exact probabilistic cycle of rare bulk buyers.

### Pseudo-WRMSSE Back-test Results
| Method | Pseudo-WRMSSE | Notes |
|--------|---------------|-------|
| Seasonal Naive | 3.314 | Standard baseline |
| V2 (Manual Heuristics) | 0.518 | High risk of overfitting |
| V3 (WRMSSE Loss Only) | 0.575 | Robust, mathematical proxy |
| **V4 (Grandmaster Model)** | **0.569** | **BEST: Tweedie + Advanced Features** |

---

## 📂 Repository Structure
```text
hbaac/
├── dataset/                    # Raw CSV datasets
├── processed/                  # Intermediate processed parquet files
├── models/
│   └── lgbm_v4_grandmaster.txt # Best global model
├── submissions/
│   └── submission_v4_grandmaster.csv # ✅ FINAL SUBMISSION
├── 01_eda.py                   
├── 02_preprocessing.py         
├── 03_feature_engineering.py   
├── 08_advanced_model.py        # V3 Pipeline
├── 09_grandmaster_model.py     # V4 Pipeline (Grandmaster)
├── run_all.py                  # Full pipeline runner
└── README.md                   
```

---

## ⚙️ Setup & Reproduction

### 1. Create virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pandas numpy lightgbm scikit-learn matplotlib pyarrow
```

### 2. Run full pipeline
```bash
source .venv/bin/activate
python run_all.py --from 9
```

### 3. Submit
Upload `submissions/submission_v4_grandmaster.csv` to Kaggle.
