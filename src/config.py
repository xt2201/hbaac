from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "dataset"
PROC_DIR = ROOT_DIR / "processed"
MODEL_DIR = ROOT_DIR / "models"
SUB_DIR = ROOT_DIR / "submissions"
EDA_DIR = ROOT_DIR / "eda_output"

TRAIN_END = "2025-09-05"
VALID_START = "2025-09-06"
