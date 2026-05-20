from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "dataset"
PROC_DIR = ROOT_DIR / "processed"
MODEL_DIR = ROOT_DIR / "models"
SUB_DIR = ROOT_DIR / "submissions"
EDA_DIR = ROOT_DIR / "eda_output"

DATA_START = "2020-11-17"
TRAIN_START = "2022-01-01"  # regime shift ~9x scale from 2022
TRAIN_END = "2025-09-05"
VALID_START = "2025-09-06"

HORIZON = 56
VAL_DAYS = 56
TOP_TIER_N = 50
TAIL_TXN_MAX = 10
P90_CAP_MULT = 1.5

MAGIC_MULT_DEFAULT = 0.88  # tuned via scripts/tune_magic.py holdout
MAGIC_MULT_TOP_TIER = 1.0
MAGIC_MULT_TAIL = 0.85
TAIL_BLEND_ALPHA = 0.7  # LGBM weight for tail SKUs; rest = DOW seasonal naive
TOP_BIAS_ENABLED = True  # residual correction for top-50 SKUs from holdout

# V6
TOP_TIER_200 = 200
MID_TIER_TXN = 100
LGBM_SEEDS = [42, 123, 456, 789, 2024]
CATBOOST_SEEDS = [42, 123, 456]
HOLDOUT_START = "2025-08-09"
DIRECT_MAX_TRAIN_ROWS = 800_000
OPTUNA_TRIALS = 50
ENSEMBLE_BLEND_PATH = PROC_DIR / "ensemble_weights.json"
DIRECT_BLEND_PATH = PROC_DIR / "direct_blend_alphas.json"
TOP_BIAS_MATRIX_PATH = PROC_DIR / "top_bias_matrix.npy"
FEATURE_PANEL_V6 = PROC_DIR / "feature_panel_v6.parquet"
