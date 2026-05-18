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
* **RMSSE** is computed per SKU, scaling the forecast error by the historical one-step naive baseline error of that SKU.
* **WRMSSE** aggregates individual RMSSEs using a profit-based weight. The weight for each SKU is its share of total profit over the training set:
  $$\text{profit}_i = \sum_{\text{train}} (\text{SalesAmount} - \text{CostAmount})$$
* SKUs with negative overall profit are assigned a weight of 0.

For more details on mathematical formulation and competition flow, see the [Overview Documentation](docs/Overview.md).

---

## 📂 Repository Structure
```text
├── dataset/             # Raw CSV datasets (ignored by git)
│   ├── train.csv
│   └── sample_submission.csv
├── docs/                # Project documentation and specifications
│   └── Overview.md      # Detailed problem explanation and metric formulas
├── .gitignore           # Standard git exclusion patterns
└── README.md            # Project landing page (this file)
```
