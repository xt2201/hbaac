# HBAAC: Vietnamese Auto Parts Demand Forecasting

Predict daily sales quantity for the next **56 days** across **15,972 SKUs**, using transaction history **2020-11-17 → 2025-09-05**.

## Goal

- Capture seasonality and trend for high-profit SKUs
- Avoid over-predicting sparse SKUs (long tail)
- Handle returns appropriately; final predictions must be **non-negative**
- Optimize **WRMSSE** (profit-weighted RMSSE)

## Evaluation: WRMSSE

Per-SKU RMSSE is scaled by a naive one-step denominator, then aggregated with **profit weights**. Lower is better.

| Window | Dates | Rows in submission |
|--------|-------|-------------------|
| Public (`_validation`) | 2025-09-06 → 2025-10-03 | F1–F28 |
| Private (`_evaluation`) | 2025-10-04 → 2025-10-31 | F1–F28 |

---

## Run on a new machine (from scratch)

### 1. Clone and environment

```bash
git clone git@github.com:xt2201/hbaac.git
cd hbaac
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Requirements:** Python 3.10+, ~8 GB disk for `processed/`, **16 GB+ RAM** recommended (feature panel ~17M rows). For full ensemble + direct training, **32 GB RAM** is safer.

### 2. Dataset (not in git)

Create `dataset/` and add competition files:

```text
dataset/
  train.csv
  sample_submission.csv
```

Download from the competition page and place both files there.

### 3. EDA (optional, ~1 min)

```bash
python scripts/run_eda_v2.py
```

Generates `eda_output/` (gitignored): charts 01–18, `EDA_REPORT.md`, `unmapped_calendar_gaps.csv`.

### 4. V6 pipeline — recommended order

**Option A — step by step (control memory):**

```bash
source .venv/bin/activate

# ~1 min
python src/preprocessor.py

# ~3–5 min, needs ~8 GB RAM peak
python src/feature_builder_v6.py

# ~30–60 min (--fast: 3 LGBM seeds only)
python scripts/train_ensemble.py --fast

# ~10–20 min (top-200; direct may need more RAM)
python scripts/train_aux_models.py

# ~3–5 min if models exist
python src/forecaster_v6.py --skip-train --fast
```

**Option B — one command:**

```bash
python scripts/pipeline_v6.py --fast
```

**Outputs (local, gitignored):**

| Path | Description |
|------|-------------|
| `processed/feature_panel_v6.parquet` | Training features (~17M rows) |
| `processed/sku_weights.csv` | WRMSSE weights |
| `processed/ensemble_weights.json` | OOF stack weights |
| `models/lgbm_v6_s*.txt` | Ensemble LGBM |
| `models/lgbm_v6_top200.txt` | Top-200 model |
| `models/lgbm_v6_direct.txt` | Direct horizon (optional) |
| `submissions/submission_v6.csv` | **Submit this** |
| `submissions/submission_v6_direct_heavy.csv` | Variant (more direct blend) |

### 5. If training runs out of memory (OOM)

1. Use `--fast` everywhere (3 LGBM seeds, skip two-stage tail in `train_ensemble.py`).
2. Run `train_aux_models.py` alone after ensemble — it filters top-200 SKUs and recent dates for direct.
3. Forecast without direct model (still works):

   ```bash
   python src/forecaster_v6.py --skip-train --fast
   ```

4. Holdout report printed at end: `all` / `h_le_28` / `h_gt_28`.

### 6. Diagnostics

```bash
python scripts/eda_error_decomp.py   # needs processed/*.npy from forecaster
python scripts/tune_magic.py         # V5 MAGIC tune only
python scripts/optuna_hpo.py         # optional HPO
```

### 7. Submit to Kaggle

Upload `submissions/submission_v6.csv` (or `submission_v5.csv` from V5 pipeline).

Reproduction form: https://forms.gle/obAgu3dTSBT1oDGJA

---

## Repository layout

```text
hbaac/
├── dataset/                 # YOU add train.csv, sample_submission.csv
├── processed/               # generated parquet, weights (gitignored)
├── models/                  # trained boosters (gitignored)
├── submissions/             # CSV outputs (gitignored)
├── eda_output/              # EDA charts (gitignored)
├── src/
│   ├── config.py
│   ├── preprocessor.py
│   ├── feature_builder.py       # V5 features
│   ├── feature_builder_v6.py    # V6 features
│   ├── forecaster.py            # V5
│   ├── forecaster_v6.py         # V6 ensemble + blend
│   ├── ensemble.py
│   ├── direct_horizon.py
│   ├── top_sku_model.py
│   ├── intermittent.py
│   ├── wrmsse_feval.py
│   ├── eval_wrmsse.py
│   ├── postprocess.py
│   ├── v5_features.py
│   └── v6_features.py
├── scripts/
│   ├── pipeline.py
│   ├── pipeline_v6.py
│   ├── run_eda_v2.py
│   ├── train_ensemble.py
│   ├── train_aux_models.py
│   ├── eda_error_decomp.py
│   └── optuna_hpo.py
└── docs/Overview.md
```

---

## Pipeline V5 (baseline)

```bash
python scripts/pipeline.py
# or:
python src/preprocessor.py
python src/feature_builder.py
python src/forecaster.py
```

Upload `submissions/submission_v5.csv`. Holdout WRMSSE ~0.473 with top-50 bias.

### V5 highlights

- Train from 2022 (regime shift)
- `is_saturday` / `is_sunday`, Sunday hard-zero
- Top-50 bias, tiered post-process, aligned WRMSSE eval

---

## V6 highlights (vs V5)

- 3–5× LGBM ensemble + OOF stack by tier (top / mid / tail)
- Top-200 dedicated model + horizon bias matrix
- Direct multi-horizon model (optional, RAM-heavy)
- Croston + two-stage tail; WRMSSE feval for early stopping
- Features: `global_qty_index`, `is_pre_holiday`, `days_since_holiday`, Sep-2025 mask

See `eda_output/EDA_REPORT.md` after running `run_eda_v2.py` for EDA → feature mapping.
