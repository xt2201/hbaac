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

MAGIC_MULT_DEFAULT = 0.96
MAGIC_MULT_TOP_TIER = 1.0
