# Goal
Predict daily sales quantity for the next 56 days across roughly 15,972 SKUs of a Vietnamese Auto Parts distributor based on nearly 5 years of transaction history (2020-11-17 → 2025-09-05).

This is a classic retail demand forecasting problem: the SKU distribution is long-tailed a small number of SKUs contribute most of the profit, while many sell sparsely. A good model must capture seasonality / trend for the best-selling SKUs, avoid over-predicting sparse SKUs and handle returns transactions appropriately.

# Leaderboard
The Public score (Validation) is computed on the first 28 days of the horizon (F1..F28 = 2025-09-06 → 2025-10-03) and the Private score (Evaluation) is computed on the next 28 days (F29..F56 = 2025-10-04 → 2025-10-31).

# Competition flow
The top teams (lowest WRMSSE on the Private leaderboard) will advance to the next round. Lower score is better.

```markdown
# Evaluation

## Metric: WRMSSE

The competition is scored using a **Weighted Root Mean Squared Scaled Error (WRMSSE)** computed per SKU and aggregated by profit weight. **Lower is better.**

## 1 - RMSSE

$$RMSSE = \sqrt{\frac{\frac{1}{h}\sum_{t=n+1}^{n+h}(Y_t - \hat{Y}_t)^2}{\frac{1}{n-1}\sum_{t=2}^{n}(Y_t - Y_{t-1})^2}}$$

where:

- **Y_t** is the actual value of the time series at time *t*
- **Ŷ_t** is the forecast at time *t*
- **n** is the length of the training sample (number of historical observations)
- **h** is the forecasting horizon

The denominator is the **mean squared error of the naive one-step forecast** (Ŷt = Y{t-1}) computed on the SKU's training data. Interpretation:

- **RMSSE = 1** → your model ties the naive baseline
- **RMSSE < 1** → better than the naive baseline
- **RMSSE > 1** → worse than the naive baseline

## 2 - Aggregate by profit weight

The final score is the **weighted average** of per-SKU RMSSE, where the weight is **each product's share of total profit on the training set**:

$$WRMSSE = \sum_i RMSSE_i \times w_i$$

1. For each SKU `i`, compute **cumulative profit over the entire training set** (2020-11-17 → 2025-09-05): `profit_i = Σ_train ( SalesAmount - CostAmount )`
2. **A product with negative profit is treated as having weight 0** (`profit_i < 0 → profit_i := 0`).

---

# Note

## Eligibility

- **Team size limit: 4 members.**
- Each individual may join only one team.
- ⚠️ **Team name & membership must EXACTLY match the registered team** — all members must join the Kaggle team that corresponds to their registered team, and the Kaggle team name must match the registered team name. **Teams that fail to comply will be disqualified** from the final ranking.

## Submissions

- Up to **5 submissions / day** per team.
- The 2 submissions selected for the Private leaderboard default to the 2 best Public-score submissions and you can change the selection at any time before the deadline.
- In addition to your Kaggle submissions, **each team must submit this form including a link to your code** (GitHub repo, Kaggle Notebook, Google Colab, or equivalent) that fully reproduces your final results by 23:59 21/5. Teams that fail to do so will be disqualified from the final ranking.
- **Link:** https://forms.gle/obAgu3dTSBT1oDGJA

## External data

- **Allowed** — external data, pre-trained models, and open-source libraries may be used without restriction.
- Participants are responsible for the licence / usage rights of any such data or model.

## Forbidden

- Creating multiple accounts to bypass the submission limit.
- Privately sharing code or data between teams. Any shared content must be public to all participants (via Discussion or a public notebook).

## Timeline (VietNam, GMT+7)

- **Start:** 2026-05-17 20:00.
- **Final submission deadline:** 2026-05-21 23:59.
- **Private leaderboard + list of advancing teams:** announced right after the deadline.

```markdown
# Dataset Description

## Files provided

| File | Description |
|------|-------------|
| `train.csv` | Detailed transaction history, **711,980 rows**, 2020-11-17 → 2025-09-05. Each row is a transaction line. |
| `sample_submission.csv` | Submission template. **(31,944 rows × 29 cols)**: each SKU has two rows — `<SKU>_validation` (Public window) and `<SKU>_evaluation` (Private window) each with 28 forecast columns `F1..F28`. All zeros is a placeholder. |

## Columns of `train.csv`

| Column | Type | Meaning |
|--------|------|---------|
| `Date` | YYYY-MM-DD | Date of the transaction. |
| `Stt` | int | Internal row sequence number. |
| `ItemCode` | string | SKU code, e.g. `SKU-08063`. |
| `Quantity` | int | Quantity. **Positive** for sales, **negative** for returns. |
| `UnitPrice` | string (decimal `,`) | Unit selling price (VND). |
| `SalesAmount` | int | Line revenue = `UnitPrice × Quantity` (VND). |
| `Unit Cost` | string (decimal `,`) | Unit cost (VND). |
| `Cost Amount` | int | Line cost = `Unit Cost × Quantity` (VND). |

---

**Warning about return transactions**

Orders with `Quantity`, `SalesAmount` and `Cost Amount` all being **negative** are customer return transactions.
**Participants must handle return data appropriately.**
**Important**: whichever approach you take, **the final prediction (`Quantity` in your submission) MUST be a non-negative.**

## `sample_submission.csv` format

The submission file has a header and looks like the following:

```
id,F1,F2,...,F28
SKU-00001_validation,0,0,...,0
SKU-00002_validation,0,0,...,0
...
SKU-00001_evaluation,0,0,...,0
SKU-00002_evaluation,0,0,...,0
...

Each row contains an `id` that is a concatenation of an `<ItemCode>` and a suffix, which is either:
- `validation` — corresponding to the Public leaderboard, **F1..F28 = 2025-09-06 → 2025-10-03**
- `evaluation` — corresponding to the Private leaderboard, **F1..F28 = 2025-10-04 → 2025-10-31**

You are predicting **28 forecast days (F1 – F28)** of demand for each row. Total rows: **31,944** (15,972 SKUs × 2 windows).

- Each forecast value must be a **non-negative** (float). Negatives are clipped to 0. The metric scores floats directly — **no rounding**.
- Submissions with duplicate `id` are rejected.
- Your submission **must contain exactly the same set of `id` as `sample_submission.csv`** — missing any row will trigger a `Submission Scoring Error`.
