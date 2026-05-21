# V6 Issue Trace — Root Causes (train heavy + LB worse than V4/V5)

## Executive summary

V6 failed for **two independent reasons**:

1. **Engineering / calibration**: submission scale ~**5.6×** V5 (mean 0.26 vs 0.046); tail SKU ~**38×** over-predict → WRMSSE on Kaggle explodes.
2. **Operations / memory**: 17.5M-row panel + 56× direct horizon + multi-seed ensemble → **OOM (exit 137)**; pipeline shipped **incomplete** (no direct, 3/5 LGBM, no CatBoost).

Internal holdout **0.33** looked good but measured a **different thing** than the miscalibrated submission file.

---

## 1. Submission scale (primary LB killer)

| Metric | V4 | V5 | V6 |
|--------|----|----|-----|
| Mean prediction | 0.051 | 0.046 | **0.260** |
| Total qty sum | ~46k | ~41k | **~233k** |
| Tail mean (≤10 txns) | — | 0.008 | **0.31** |

WRMSSE punishes over-prediction on sparse SKUs. V6 tail blend inflated mass predictions.

### 1.1 Tail Croston blend in recursive loop

```python
# forecaster_v6.py ~L259-261
pred[tier_tail] = 0.5 * pred[tier_tail] + 0.5 * croston_full[tier_tail, day_idx]
```

- Croston on **~9k SKUs** with median 7 transactions → many get **positive constant rate**.
- V5 uses MAGIC **0.85** + **DOW naive blend 0.7/0.3** on **already shrunk** LGBM preds.
- V6 applies MAGIC after Croston inflate; tail still ~38× V5.

### 1.2 Top-200 in-loop blend (45%)

```python
pred[top200_mask] = 0.55 * pred[top200_mask] + 0.45 * top_pred[top200_mask]
```

- Separate top-200 model trained on **subset** can **over-predict** mid-tier whales.
- Applied **every recursive day** → errors compound in lags.

### 1.3 Missing V5 top-50 bias in recursive loop

| V5 | V6 |
|----|-----|
| `top_bias_arr` from holdout, applied **inside** `apply_postprocess` each day | `top_bias=None` in loop |
| Per-SKU scalar correction | Only `top_bias_matrix` at end (top-200, holdout-derived) |

V5 holdout bias was critical (0.492 → 0.473). V6 dropped it.

### 1.4 Ensemble OOF weights degenerate

`processed/ensemble_weights.json`:

- mid/tail tiers: **~89% weight on `lgbm_123` only** (not a real ensemble).
- Behaves like a single high-variance model, not variance reduction.

### 1.5 No direct horizon in production file

- `lgbm_v6_direct.txt` never saved (OOM).
- `submission_v6.csv` == `submission_v6_direct_heavy.csv` (identical).
- Plan benefit for Private (h>28) **not realized**.

---

## 2. Training too heavy (OOM)

| Step | Memory driver | Result |
|------|---------------|--------|
| `feature_builder_v6.py` | 15,972 SKUs × ~1,100 days panel loop | 17.5M rows parquet OK |
| `train_ensemble.py` | Full panel × 3 LGBM | 3 models saved, then **killed** |
| `train_direct` | Panel × **56 horizons** concat | **OOM** |
| `train_aux_models` top200 | Filter 200 SKUs | OK |
| `forecaster_v6` skip-train | Still loads **150d × all SKUs** | Ran; submission bug fixed later |

### 2.1 Direct horizon row explosion

`build_horizon_training_frame`: each (date, sku) × 56 horizons → up to **~1B rows** before `DIRECT_MAX_TRAIN_ROWS` subsample.

Subsample uses `weight` probability but still must **materialize** concat in memory first.

### 2.2 No column pruning

`pd.read_parquet(FEATURE_PANEL_V6)` loads **74 columns × millions of rows** repeatedly.

### 2.3 CatBoost / 5 seeds / two-stage

Never completed in `--fast` run; two-stage on 3000 tail SKUs also dropped.

---

## 3. Metric confusion (false confidence)

| Report | Value | Issue |
|--------|-------|-------|
| V6 holdout `all` | 0.330 | Last 28d of **train** as anchor+horizon |
| V5 holdout | 0.473 | Different bias calibration |
| Fold A | 0.633 | Misaligned / duplicate eval window |
| Kaggle LB | Worse than V5 | Submission mean 0.26 |

**Lesson:** Never trust holdout until submission **mean/tier ratios** match calibrated V5.

---

## 4. Feature / holiday gaps (secondary)

- `ALL_HOLIDAYS` in `v5_features.py` covers **~21** fixed dates + 5 Tet anchors.
- Calendar audit: **76** non-Sunday missing days **not** in legacy list.
- See `eda_output/CALENDAR_AUDIT_REPORT.md` and `calendar_all_days.csv`.

Missing holiday features → model treats closures as random zeros → poor generalization on Public/Private holidays.

---

## 5. Recommended path (do not patch V6 in place)

1. **Stop submitting `submission_v6.csv`** until recalibrated.
2. **Keep V5** as production (`submission_v5.csv`).
3. If revisiting ML:
   - Train **single** LGBM V5-style + V5 postprocess first.
   - Add direct horizon with **streaming/chunked** training, h=1..28 only.
   - Prove tail mean ≤ 0.02 on validation before ensemble.
4. Run `python scripts/audit_calendar_full.py` → extend `ALL_HOLIDAYS` from `new_holiday_candidates.csv` (careful: only recurring national).

---

## 6. File checklist (what exists)

| Artifact | Status |
|----------|--------|
| `lgbm_v6_s42/123/456.txt` | OK |
| `lgbm_v6_top200.txt` | OK |
| `lgbm_v6_direct.txt` | **Missing** |
| `ensemble_weights.json` | Degenerate |
| `submission_v6.csv` | **Miscalibrated** |
| `feature_panel_v6.parquet` | 17.5M rows |

---

## 7. Code locations to fix (if V7)

| Issue | File |
|-------|------|
| Tail Croston blend | `src/forecaster_v6.py` L259-264 |
| Top bias in loop | `src/forecaster.py` L395-405 → port to V6 |
| Top200 in-loop blend | Reduce or move to post-hoc only |
| Direct OOM | `src/direct_horizon.py`, `scripts/train_aux_models.py` |
| Holidays | `src/v5_features.py`, `src/vn_calendar.py` |
