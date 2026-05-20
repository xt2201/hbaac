# HBAAC: Vietnamese Auto Parts Demand Forecasting

Predict daily sales quantity for the next **56 days** across **15,972 SKUs** (Vietnamese auto parts distributor), using transaction history **2020-11-17 → 2025-09-05**.

## Goal

- Capture seasonality and trend for high-profit SKUs
- Avoid over-predicting sparse SKUs (long tail)
- Handle returns appropriately; final predictions must be **non-negative**
- Optimize **WRMSSE** (profit-weighted RMSSE)

## Evaluation: WRMSSE

Per-SKU RMSSE is scaled by a naive one-step denominator, then aggregated with **profit weights** from training. Lower is better.

- **Public** (`_validation`): F1–F28 = 2025-09-06 → 2025-10-03
- **Private** (`_evaluation`): F1–F28 = 2025-10-04 → 2025-10-31

## Dataset

Place files in `dataset/` (gitignored):

| File | Description |
|------|-------------|
| `train.csv` | 711,980 transaction rows |
| `sample_submission.csv` | 31,944 × 29 template |

## Pipeline (V5)

```text
hbaac/
├── dataset/                 # train.csv, sample_submission.csv
├── processed/               # parquet + sku_weights.csv
├── models/                  # lgbm_v5.txt
├── submissions/             # submission_v5.csv
├── eda_output/              # EDA charts
├── src/
│   ├── config.py
│   ├── preprocessor.py
│   ├── feature_builder.py
│   ├── forecaster.py        # V5 train + forecast
│   └── eval_wrmsse.py
├── scripts/
│   ├── pipeline.py          # run full pipeline
│   └── run_eda.py
└── docs/Overview.md
```

### V5 improvements (from EDA)

1. **Train from 2022** — regime shift (~9× volume)
2. **`is_saturday` / `is_sunday`** — Sunday ≈ closed (hard-zero at forecast)
3. **Return rate features** — post-2022 returns ~3.5%
4. **`is_october` + lag-364** — Private window is full October
5. **SKU stats without val leakage** — stats cutoff before last 56 train days
6. **Tiered post-process** — top-50 SKU (no shrink), tail ≤10 txns (strong shrink), P90 cap
7. **Aligned WRMSSE holdout** — last 28 days of train

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
source .venv/bin/activate
python scripts/pipeline.py
```

Or step by step:

```bash
python src/preprocessor.py
python src/feature_builder.py
python src/forecaster.py
```

Tune `MAGIC_MULT` on holdout, then re-forecast without retraining:

```bash
python scripts/tune_magic.py
python src/forecaster.py --forecast-only
```

EDA:

```bash
python scripts/run_eda.py
```

## Submit

Upload `submissions/submission_v5.csv` to Kaggle.

Code reproduction form: https://forms.gle/obAgu3dTSBT1oDGJA (deadline 23:59 21/5 GMT+7).
