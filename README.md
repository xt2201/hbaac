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

### 2. Dataset (included in repo)

Competition files are committed under `dataset/` (~46 MB):

```text
dataset/
  train.csv
  sample_submission.csv
```

After `git clone`, no extra download is needed.

### 3. EDA (optional, ~1 min)

```bash
python scripts/run_eda_v2.py
python scripts/audit_calendar_full.py   # classify all 1,754 days (VN/intl holidays)
```

Generates `eda_output/` (gitignored): charts 01–18, `EDA_REPORT.md`, `CALENDAR_AUDIT_REPORT.md` (appendix: all 343 missing days), `calendar_all_days.csv`.

**V6 postmortem:** see `docs/V6_ISSUE_TRACE.md` — `submission_v6.csv` was miscalibrated; **use V5.1 for Kaggle**, not V6.

### 4. V5.1 pipeline — recommended (Kaggle)

Expanded Vietnam calendar (`ALL_HOLIDAYS` ~161 dates), same post-process as V5 (top-50 bias, tail shrink, Sunday hard-zero).

#### Quick run (no Optuna — ~10 min after panel exists)

```bash
source .venv/bin/activate

python src/preprocessor.py
python src/feature_builder.py
python src/forecaster.py --tag v51
```

Output: `submissions/submission_v51.csv`, `models/lgbm_v51.txt`

#### Full tune from scratch (Optuna + post-process — ~3–4 hours)

```bash
source .venv/bin/activate
pip install -r requirements.txt   # includes optuna

# All steps: preprocess → features → 35 Optuna trials → post-process grid → forecast
python scripts/pipeline_v51_full.py
```

Or step by step:

```bash
python src/preprocessor.py
python src/feature_builder.py
python scripts/tune_v51.py --optuna-trials 35 --fresh
```

| Flag | Meaning |
|------|---------|
| `--fresh` | Delete Optuna DB/log and start a new study |
| `--skip-optuna` | Use existing `models/lgbm_v51.txt`, only tune post-process (~25 min) |
| `--skip-retrain` | Keep LGBM after post-process tune; still runs forecast unless `--skip-forecast` |
| `--optuna-trials N` | Number of Optuna trials (default 60) |

**Optuna artifacts (saved every trial — safe to stop and resume):**

| Path | Description |
|------|-------------|
| `processed/v51_optuna.db` | SQLite study (`load_if_exists` resume) |
| `processed/v51_optuna_best.json` | Best `lgbm_params` + holdout WRMSSE |
| `processed/v51_optuna_trials.jsonl` | One JSON line per finished trial |
| `processed/v51_best_config.json` | Final LGBM + post-process params after full `tune_v51.py` |

**Resume after interrupt** (do not pass `--fresh`):

```bash
python scripts/tune_v51.py --optuna-trials 35
```

**Forecast only** (model + config already tuned):

```bash
python src/forecaster.py --tag v51 --forecast-only
```

**Monitor progress:**

```bash
tail -f processed/v51_optuna_trials.jsonl
cat processed/v51_optuna_best.json
```

**Submit:** `submissions/submission_v51.csv`

Post-process defaults live in `src/config.py` (updated by `tune_v51.py`). Tuned LGBM hyperparams are loaded from `processed/v51_best_config.json` when training with `--tag v51`.

---

### 5. V6 pipeline (experimental — not for Kaggle until recalibrated)

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

### 6. If V6 training runs out of memory (OOM)

1. Use `--fast` everywhere (3 LGBM seeds, skip two-stage tail in `train_ensemble.py`).
2. Run `train_aux_models.py` alone after ensemble — it filters top-200 SKUs and recent dates for direct.
3. Forecast without direct model (still works):

   ```bash
   python src/forecaster_v6.py --skip-train --fast
   ```

4. Holdout report printed at end: `all` / `h_le_28` / `h_gt_28`.

### 7. Diagnostics

```bash
python scripts/eda_error_decomp.py   # needs processed/*.npy from forecaster
python scripts/tune_magic.py         # V5 MAGIC tune only
python scripts/optuna_hpo.py         # optional HPO
```

### 8. Submit to Kaggle

Upload **`submissions/submission_v51.csv`** (recommended). Alternatives: `submission_v5.csv`. Do **not** submit `submission_v6.csv` until recalibrated.

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
│   ├── pipeline_v51.py
│   ├── pipeline_v51_full.py   # preprocess + features + tune_v51
│   ├── tune_v51.py            # Optuna LGBM + post-process (persists to processed/)
│   ├── pipeline_v6.py
│   ├── run_eda_v2.py
│   ├── audit_calendar_full.py
│   ├── audit_calendar_deep.py
│   ├── train_ensemble.py
│   ├── train_aux_models.py
│   ├── eda_error_decomp.py
│   ├── tune_magic.py
│   └── optuna_hpo.py
└── docs/Overview.md
```

---

## Pipeline V5 (legacy baseline)

```bash
python scripts/pipeline.py
```

Upload `submissions/submission_v5.csv`. Holdout WRMSSE ~0.473.

See **§4 V5.1** above for the recommended path (`submission_v51.csv`).

### V5 / V5.1 highlights

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

See `eda_output/EDA_REPORT.md` after `python scripts/run_eda_v2.py` (charts 01–22). Deep calendar: `audit_calendar_deep.py` → `DEEP_CALENDAR_ANALYSIS.md`.

---

## Web dashboard & AnalyticsBot

The merged `origin/main` branch adds a Next.js app under `app/` (forecast dashboard, replenishment, watchlist, AnalyticsBot chat).

```bash
pnpm install
pnpm dev
```

See `.env.example` for required environment variables.
