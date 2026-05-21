"""
Thorough V5.1 tuning: Optuna LGBM hyperparameters + grid post-process on aligned holdout.

Writes:
  - processed/v51_best_config.json
  - models/lgbm_v51_tuned.txt (best LGBM checkpoint)
Updates src/config.py post-process constants, then runs forecaster --tag v51.

Usage:
  python scripts/tune_v51.py --optuna-trials 60 --skip-optuna  # postprocess only
  python scripts/tune_v51.py --optuna-trials 60               # full tune + forecast
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from config import (  # noqa: E402
    DATA_DIR,
    MODEL_DIR,
    PROC_DIR,
    ROOT_DIR,
    TAIL_TXN_MAX,
    TOP_TIER_N,
    TRAIN_END,
    VAL_DAYS,
)
from eval_wrmsse import load_sku_weights  # noqa: E402
from v5_features import FEAT_COLS, enrich_panel  # noqa: E402

CONFIG_PATH = ROOT_DIR / "src" / "config.py"
V51_CONFIG_PATH = PROC_DIR / "v51_best_config.json"
TRAIN_END_TS = pd.Timestamp(TRAIN_END)
HOLDOUT_START = TRAIN_END_TS - pd.Timedelta(days=27)
VAL_START_TS = TRAIN_END_TS - pd.Timedelta(days=VAL_DAYS - 1)

DEFAULT_LGBM = {
    "objective": "tweedie",
    "tweedie_variance_power": 1.25,
    "metric": "rmse",
    "learning_rate": 0.05,
    "num_leaves": 255,
    "max_depth": 10,
    "min_data_in_leaf": 100,
    "feature_fraction": 0.7,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambda_l1": 0.1,
    "lambda_l2": 0.1,
    "verbose": -1,
    "n_jobs": -1,
    "seed": 42,
}


def _wrmsse_holdout_df(holdout_df: pd.DataFrame, sub_skus: list, sku_weights: pd.DataFrame) -> float:
    score = 0.0
    for sku in sub_skus:
        w = float(sku_weights.loc[sku, "weight"]) if sku in sku_weights.index else 0.0
        if w <= 0:
            continue
        denom = float(sku_weights.loc[sku, "wrmsse_denom"]) if sku in sku_weights.index else 1e-8
        sub = holdout_df[holdout_df["ItemCode"] == sku]
        if len(sub) == 0:
            continue
        rmse = np.sqrt(np.mean((sub["qty"].values - sub["pred"].values) ** 2))
        score += w * (rmse / np.sqrt(denom))
    return score


def _apply_postprocess_day(
    pred: np.ndarray,
    dow: int,
    tier_top: np.ndarray,
    tier_tail: np.ndarray,
    magic: np.ndarray,
    dow_naive_row: np.ndarray,
    sku_p90: np.ndarray,
    tail_alpha: float,
    p90_mult: float,
) -> np.ndarray:
    out = pred.astype(np.float32, copy=True) * magic
    if tier_tail.any():
        out[tier_tail] = tail_alpha * out[tier_tail] + (1.0 - tail_alpha) * dow_naive_row[tier_tail]
    cap = sku_p90 * p90_mult
    out = np.where(tier_top, out, np.minimum(out, cap))
    out = np.clip(out, 0, None)
    if dow == 6:
        out[:] = 0.0
    return out


def eval_holdout_wrmsse(
    raw_by_date: dict[pd.Timestamp, np.ndarray],
    qty_by_date: dict[pd.Timestamp, np.ndarray],
    sub_skus: list,
    sku_weights: pd.DataFrame,
    top_tier: set,
    tier_tail: np.ndarray,
    dow_naive: np.ndarray,
    sku_p90: np.ndarray,
    magic_default: float,
    magic_tail: float,
    magic_top: float,
    tail_alpha: float,
    p90_mult: float,
    apply_top_bias: bool = True,
) -> tuple[float, np.ndarray]:
    n = len(sub_skus)
    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    tier_top = np.array([s in top_tier for s in sub_skus])
    magic = np.full(n, magic_default, dtype=np.float32)
    magic[tier_top] = magic_top
    magic[tier_tail] = magic_tail

    parts = []
    for date in sorted(raw_by_date.keys()):
        dow = int(pd.Timestamp(date).dayofweek)
        pred = _apply_postprocess_day(
            raw_by_date[date],
            dow,
            tier_top,
            tier_tail,
            magic,
            dow_naive[dow],
            sku_p90,
            tail_alpha,
            p90_mult,
        )
        qty = qty_by_date[date]
        for i, sku in enumerate(sub_skus):
            parts.append((sku, float(qty[i]), float(pred[i])))

    holdout_df = pd.DataFrame(parts, columns=["ItemCode", "qty", "pred"])
    top_bias = np.zeros(n, dtype=np.float32)
    if apply_top_bias:
        for sku in top_tier:
            sub = holdout_df[holdout_df["ItemCode"] == sku]
            if len(sub) == 0:
                continue
            top_bias[sku_to_i[sku]] = float(np.clip((sub["qty"] - sub["pred"]).mean(), -50, 50))
        holdout_df["pred"] = holdout_df.apply(
            lambda r: r["pred"] + top_bias[sku_to_i[r["ItemCode"]]]
            if r["ItemCode"] in top_tier
            else r["pred"],
            axis=1,
        ).clip(lower=0)
    return _wrmsse_holdout_df(holdout_df, sub_skus, sku_weights), top_bias


def _prepare_holdout_cache(fp: pd.DataFrame, sub_skus: list, model: lgb.Booster) -> tuple:
    mask = (fp["Date"] >= HOLDOUT_START) & (fp["Date"] <= TRAIN_END_TS)
    hold = fp.loc[mask, ["ItemCode", "Date", "qty", "dayofweek"]].copy()
    hold["raw"] = model.predict(fp.loc[mask, FEAT_COLS])

    sku_to_i = {s: i for i, s in enumerate(sub_skus)}
    n = len(sub_skus)
    raw_by_date: dict[pd.Timestamp, np.ndarray] = {}
    qty_by_date: dict[pd.Timestamp, np.ndarray] = {}
    for date, grp in hold.groupby("Date"):
        raw = np.zeros(n, dtype=np.float32)
        qty = np.zeros(n, dtype=np.float32)
        for _, row in grp.iterrows():
            i = sku_to_i[row["ItemCode"]]
            raw[i] = row["raw"]
            qty[i] = row["qty"]
        raw_by_date[date] = raw
        qty_by_date[date] = qty
    return raw_by_date, qty_by_date


def _build_dow_naive(daily_qty: pd.DataFrame, sub_skus: list) -> np.ndarray:
    recent = daily_qty.iloc[-56:]
    dow_naive = np.zeros((7, len(sub_skus)), dtype=np.float32)
    for dow in range(7):
        rows = recent.loc[recent.index.dayofweek == dow]
        if len(rows) > 0:
            dow_naive[dow, :] = rows.mean(axis=0).values
    return dow_naive


def train_lgbm(fp: pd.DataFrame, params: dict, num_boost_round: int = 3000) -> lgb.Booster:
    mask_train = fp["Date"] < VAL_START_TS
    mask_val = fp["Date"] >= VAL_START_TS
    w_train = (
        fp.loc[mask_train, "weight"] / np.sqrt(fp.loc[mask_train, "wrmsse_denom"])
    ).values * fp.loc[mask_train, "decay_weight"].values
    w_val = (fp.loc[mask_val, "weight"] / np.sqrt(fp.loc[mask_val, "wrmsse_denom"])).values
    dtrain = lgb.Dataset(
        fp.loc[mask_train, FEAT_COLS],
        label=fp.loc[mask_train, "qty"],
        weight=w_train,
        categorical_feature=["ItemCode_cat"],
        feature_name=FEAT_COLS,
        free_raw_data=True,
    )
    dval = lgb.Dataset(
        fp.loc[mask_val, FEAT_COLS],
        label=fp.loc[mask_val, "qty"],
        weight=w_val,
        categorical_feature=["ItemCode_cat"],
        reference=dtrain,
        free_raw_data=True,
    )
    return lgb.train(
        params=params,
        train_set=dtrain,
        num_boost_round=num_boost_round,
        valid_sets=[dval],
        valid_names=["val"],
        callbacks=[lgb.early_stopping(150, verbose=False), lgb.log_evaluation(0)],
    )


def run_optuna(
    fp: pd.DataFrame,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    top_tier: set,
    tier_tail: np.ndarray,
    dow_naive: np.ndarray,
    sku_p90: np.ndarray,
    n_trials: int,
) -> tuple[lgb.Booster, dict]:
    """Optuna on LGBM; each trial scored with default-ish postprocess."""

    def objective(trial: optuna.Trial) -> float:
        params = {
            **DEFAULT_LGBM,
            "tweedie_variance_power": trial.suggest_float("tweedie_variance_power", 1.1, 1.55),
            "learning_rate": trial.suggest_float("learning_rate", 0.025, 0.07, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 127, 511, step=64),
            "max_depth": trial.suggest_int("max_depth", 7, 12),
            "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 50, 200, step=25),
            "feature_fraction": trial.suggest_float("feature_fraction", 0.55, 0.85),
            "bagging_fraction": trial.suggest_float("bagging_fraction", 0.65, 0.95),
            "lambda_l1": trial.suggest_float("lambda_l1", 1e-3, 0.5, log=True),
            "lambda_l2": trial.suggest_float("lambda_l2", 1e-3, 0.5, log=True),
        }
        model = train_lgbm(fp, params, num_boost_round=2000)
        raw_by_date, qty_by_date = _prepare_holdout_cache(fp, sub_skus, model)
        score, _ = eval_holdout_wrmsse(
            raw_by_date,
            qty_by_date,
            sub_skus,
            sku_weights,
            top_tier,
            tier_tail,
            dow_naive,
            sku_p90,
            magic_default=0.88,
            magic_tail=0.85,
            magic_top=1.0,
            tail_alpha=0.7,
            p90_mult=1.5,
        )
        return score

    study = optuna.create_study(
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=42),
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    best_params = {**DEFAULT_LGBM, **study.best_params}
    print(f"\nOptuna best holdout WRMSSE: {study.best_value:.6f}")
    model = train_lgbm(fp, best_params, num_boost_round=3000)
    return model, best_params


def grid_postprocess(
    raw_by_date: dict,
    qty_by_date: dict,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    top_tier: set,
    tier_tail: np.ndarray,
    dow_naive: np.ndarray,
    sku_p90: np.ndarray,
) -> dict:
    best = {"score": float("inf")}
    grid_magic = np.arange(0.84, 0.971, 0.03)
    grid_tail_magic = [0.76, 0.80, 0.84, 0.88, 0.92]
    grid_top_magic = [0.95, 1.0, 1.05]
    grid_alpha = np.arange(0.55, 0.861, 0.075)
    grid_p90 = [1.0, 1.25, 1.5, 1.75, 2.0]

    total = (
        len(grid_magic) * len(grid_tail_magic) * len(grid_top_magic) * len(grid_alpha) * len(grid_p90)
    )
    print(f"\nPost-process grid: {total} combinations …")
    done = 0
    for md in grid_magic:
        for mt in grid_tail_magic:
            for mtop in grid_top_magic:
                for alpha in grid_alpha:
                    for p90 in grid_p90:
                        score, _ = eval_holdout_wrmsse(
                            raw_by_date,
                            qty_by_date,
                            sub_skus,
                            sku_weights,
                            top_tier,
                            tier_tail,
                            dow_naive,
                            sku_p90,
                            float(md),
                            float(mt),
                            float(mtop),
                            float(alpha),
                            float(p90),
                        )
                        done += 1
                        if score < best["score"]:
                            best = {
                                "score": score,
                                "MAGIC_MULT_DEFAULT": float(md),
                                "MAGIC_MULT_TAIL": float(mt),
                                "MAGIC_MULT_TOP_TIER": float(mtop),
                                "TAIL_BLEND_ALPHA": float(alpha),
                                "P90_CAP_MULT": float(p90),
                            }
    print(f"  Best post-process WRMSSE: {best['score']:.6f}")
    return best


def fine_grid_postprocess(
    raw_by_date: dict,
    qty_by_date: dict,
    sub_skus: list,
    sku_weights: pd.DataFrame,
    top_tier: set,
    tier_tail: np.ndarray,
    dow_naive: np.ndarray,
    sku_p90: np.ndarray,
    coarse: dict,
) -> dict:
    """Refine around coarse optimum (step 0.01 magic, 0.02 tail)."""
    best = {k: coarse[k] for k in coarse}
    best["score"] = coarse["score"]
    md0 = coarse["MAGIC_MULT_DEFAULT"]
    mt0 = coarse["MAGIC_MULT_TAIL"]
    mtop0 = coarse["MAGIC_MULT_TOP_TIER"]
    a0 = coarse["TAIL_BLEND_ALPHA"]
    p0 = coarse["P90_CAP_MULT"]

    for md in np.arange(max(0.80, md0 - 0.04), min(0.99, md0 + 0.041), 0.01):
        for mt in np.arange(max(0.70, mt0 - 0.06), min(0.95, mt0 + 0.061), 0.02):
            for mtop in [mtop0 - 0.05, mtop0, mtop0 + 0.05]:
                if mtop <= 0:
                    continue
                for alpha in np.arange(max(0.45, a0 - 0.1), min(0.90, a0 + 0.101), 0.025):
                    for p90 in np.arange(max(0.9, p0 - 0.3), min(2.2, p0 + 0.301), 0.1):
                        score, _ = eval_holdout_wrmsse(
                            raw_by_date,
                            qty_by_date,
                            sub_skus,
                            sku_weights,
                            top_tier,
                            tier_tail,
                            dow_naive,
                            sku_p90,
                            float(md),
                            float(mt),
                            float(round(mtop, 2)),
                            float(alpha),
                            float(p90),
                        )
                        if score < best["score"]:
                            best = {
                                "score": score,
                                "MAGIC_MULT_DEFAULT": float(md),
                                "MAGIC_MULT_TAIL": float(mt),
                                "MAGIC_MULT_TOP_TIER": float(round(mtop, 2)),
                                "TAIL_BLEND_ALPHA": float(alpha),
                                "P90_CAP_MULT": float(round(p90, 2)),
                            }
    print(f"  Fine grid WRMSSE: {best['score']:.6f}")
    return best


def patch_config_py(pp: dict) -> None:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    replacements = {
        "MAGIC_MULT_DEFAULT": pp["MAGIC_MULT_DEFAULT"],
        "MAGIC_MULT_TOP_TIER": pp["MAGIC_MULT_TOP_TIER"],
        "MAGIC_MULT_TAIL": pp["MAGIC_MULT_TAIL"],
        "TAIL_BLEND_ALPHA": pp["TAIL_BLEND_ALPHA"],
        "P90_CAP_MULT": pp["P90_CAP_MULT"],
    }
    for key, val in replacements.items():
        text = re.sub(
            rf"^{key} = [\d.]+.*$",
            f"{key} = {val}  # tuned via scripts/tune_v51.py",
            text,
            flags=re.MULTILINE,
        )
    CONFIG_PATH.write_text(text, encoding="utf-8")
    print(f"  Updated {CONFIG_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--optuna-trials", type=int, default=60)
    parser.add_argument("--skip-optuna", action="store_true", help="Use existing lgbm_v51.txt")
    parser.add_argument("--skip-forecast", action="store_true")
    parser.add_argument(
        "--skip-retrain",
        action="store_true",
        help="Keep existing lgbm_v51.txt after post-process tune",
    )
    parser.add_argument("--postprocess-only", action="store_true", help="Alias for --skip-optuna")
    args = parser.parse_args()
    if args.postprocess_only:
        args.skip_optuna = True
        args.skip_retrain = True

    print("=" * 70)
    print("HBAAC | V5.1 thorough tuning")
    print("=" * 70)

    sample = pd.read_csv(DATA_DIR / "sample_submission.csv")
    sub_skus = sorted(
        sample["id"].str.replace("_(validation|evaluation)$", "", regex=True).unique()
    )
    sku_weights = load_sku_weights()
    top_tier = set(sku_weights.sort_values("weight", ascending=False).head(TOP_TIER_N).index)

    train = pd.read_csv(DATA_DIR / "train.csv", dtype=str)
    train["Date"] = pd.to_datetime(train["Date"])
    train["Quantity"] = pd.to_numeric(train["Quantity"], errors="coerce").fillna(0)
    daily = (
        train.groupby(["Date", "ItemCode"])["Quantity"]
        .sum()
        .reset_index()
        .pivot(index="Date", columns="ItemCode", values="Quantity")
        .fillna(0)
        .reindex(columns=sub_skus, fill_value=0)
    )
    txn_counts = train.groupby("ItemCode").size().to_dict()
    tier_tail = np.array([txn_counts.get(s, 0) <= TAIL_TXN_MAX for s in sub_skus])

    nz = daily[daily > 0]
    sku_p90 = np.array(
        [
            float(nz[s].quantile(0.9)) if s in nz.columns and len(nz[s]) > 0 else 0.0
            for s in sub_skus
        ],
        dtype=np.float32,
    )
    dow_naive = _build_dow_naive(daily, sub_skus)

    print("\nLoading feature panel …")
    fp = pd.read_parquet(PROC_DIR / "feature_panel.parquet")
    fp["Date"] = pd.to_datetime(fp["Date"])
    fp = enrich_panel(fp, sub_skus)

    model_path = MODEL_DIR / "lgbm_v51.txt"
    if args.skip_optuna and model_path.exists():
        print(f"\n[1/3] Loading {model_path} (skip Optuna)")
        model = lgb.Booster(model_file=str(model_path))
        lgbm_params = DEFAULT_LGBM.copy()
        if V51_CONFIG_PATH.exists():
            lgbm_params.update(json.loads(V51_CONFIG_PATH.read_text()).get("lgbm_params", {}))
    else:
        print(f"\n[1/3] Optuna LGBM ({args.optuna_trials} trials) …")
        model, lgbm_params = run_optuna(
            fp, sub_skus, sku_weights, top_tier, tier_tail, dow_naive, sku_p90, args.optuna_trials
        )
        model.save_model(str(MODEL_DIR / "lgbm_v51_tuned.txt"))

    print("\n[2/3] Post-process grid + fine search …")
    raw_by_date, qty_by_date = _prepare_holdout_cache(fp, sub_skus, model)
    coarse = grid_postprocess(
        raw_by_date, qty_by_date, sub_skus, sku_weights, top_tier, tier_tail, dow_naive, sku_p90
    )
    pp_best = fine_grid_postprocess(
        raw_by_date, qty_by_date, sub_skus, sku_weights, top_tier, tier_tail, dow_naive, sku_p90, coarse
    )

    config_out = {
        "holdout_wrmsse": pp_best["score"],
        "lgbm_params": lgbm_params,
        "MAGIC_MULT_DEFAULT": pp_best["MAGIC_MULT_DEFAULT"],
        "MAGIC_MULT_TAIL": pp_best["MAGIC_MULT_TAIL"],
        "MAGIC_MULT_TOP_TIER": pp_best["MAGIC_MULT_TOP_TIER"],
        "TAIL_BLEND_ALPHA": pp_best["TAIL_BLEND_ALPHA"],
        "P90_CAP_MULT": pp_best["P90_CAP_MULT"],
    }
    V51_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    V51_CONFIG_PATH.write_text(json.dumps(config_out, indent=2), encoding="utf-8")
    print(f"\nSaved → {V51_CONFIG_PATH}")
    patch_config_py(pp_best)

    if args.skip_retrain:
        print(f"\n[3/3] Skipping LGBM retrain — using {model_path}")
    else:
        print("\n[3/3] Final LGBM train with best hyperparameters …")
        final_model = train_lgbm(fp, lgbm_params, num_boost_round=3000)
        final_model.save_model(str(model_path))
        print(f"  Saved → {model_path}")

    if not args.skip_forecast:
        print("\nRunning forecaster --tag v51 …")
        subprocess.run(
            [sys.executable, str(ROOT_DIR / "src" / "forecaster.py"), "--tag", "v51", "--forecast-only"],
            cwd=str(ROOT_DIR),
            check=True,
        )

    print("\n" + "=" * 70)
    print(f"Done. Holdout WRMSSE ≈ {pp_best['score']:.6f}")
    print(f"  submission → submissions/submission_v51.csv")
    print("=" * 70)


if __name__ == "__main__":
    main()
