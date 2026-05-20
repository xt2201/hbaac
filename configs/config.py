# configs/config.py
"""
Tất cả hằng số và default hyperparameters.
Chỉnh sửa ở đây để thay đổi toàn bộ project.
"""

# ── Paths ────────────────────────────────────────────────────────────────────
DATA_DIR        = "data"
TRAIN_CSV       = f"{DATA_DIR}/train.csv"
SUBMISSION_CSV  = f"{DATA_DIR}/sample_submission.csv"
CHECKPOINT_DIR  = "checkpoints"
OUTPUT_DIR      = "outputs"

# ── Forecasting setup ────────────────────────────────────────────────────────
INPUT_SIZE  = 180   # look-back window (days)
HORIZON     = 56    # 28 validation + 28 evaluation
VAL_STEPS   = 28    # hold-out để tính WRMSSE nội bộ
GLOBAL_SEED = 42

# ── Training defaults (override bằng CLI hoặc Optuna) ────────────────────────
DEFAULT_BATCH_SIZE  = 256
DEFAULT_MAX_STEPS   = 1000
DEFAULT_LR          = 1e-3
DEFAULT_N_SEEDS_ENS = 3     # số seeds để ensemble lúc predict

# ── Model default hyperparameters ────────────────────────────────────────────
MODEL_DEFAULTS = {
    "nhits": {
        "hidden_size"      : 512,
        "n_layers"         : 2,
        "pool_kernels"     : [8, 4, 2],
        "freq_downsamples" : [24, 12, 1],
        "dropout"          : 0.0,
        "loss"             : "mae",
    },
    "nbeats": {
        "hidden_size"    : 512,
        "n_layers"       : 4,
        "n_blocks"       : 3,
        "degree_of_poly" : 3,       # trend stack
        "n_harmonics"    : 4,       # seasonality stack
        "dropout"        : 0.0,
        "loss"           : "mae",
    },
    "tft": {
        "hidden_size"  : 64,
        "lstm_layers"  : 2,
        "attn_heads"   : 4,
        "dropout"      : 0.1,
        "loss"         : "mae",
    },
    "dlinear": {
        "kernel_size"  : 25,        # moving average window for decomposition
        "individual"   : False,     # True = separate linear per series (memory heavy)
        "loss"         : "mae",
    },
}

# ── Optuna search spaces (per model) ─────────────────────────────────────────
SEARCH_SPACES = {
    "nhits": {
        "hidden_size"  : {"type": "categorical", "choices": [256, 512, 1024]},
        "n_layers"     : {"type": "int", "low": 1, "high": 4},
        "lr"           : {"type": "float", "low": 5e-5, "high": 5e-3, "log": True},
        "dropout"      : {"type": "float", "low": 0.0, "high": 0.3},
        "weight_decay" : {"type": "float", "low": 0.0, "high": 1e-3},
        "batch_size"   : {"type": "categorical", "choices": [128, 256, 512]},
        "max_steps"    : {"type": "categorical", "choices": [500, 1000, 2000]},
        "loss"         : {"type": "categorical", "choices": ["mae", "mse", "huber"]},
        "stack_config" : {"type": "int", "low": 0, "high": 5},
    },
    "nbeats": {
        "hidden_size"    : {"type": "categorical", "choices": [256, 512, 1024]},
        "n_layers"       : {"type": "int", "low": 2, "high": 6},
        "n_blocks"       : {"type": "int", "low": 2, "high": 5},
        "degree_of_poly" : {"type": "int", "low": 2, "high": 5},
        "n_harmonics"    : {"type": "int", "low": 2, "high": 8},
        "lr"             : {"type": "float", "low": 5e-5, "high": 5e-3, "log": True},
        "dropout"        : {"type": "float", "low": 0.0, "high": 0.3},
        "weight_decay"   : {"type": "float", "low": 0.0, "high": 1e-3},
        "batch_size"     : {"type": "categorical", "choices": [128, 256, 512]},
        "max_steps"      : {"type": "categorical", "choices": [500, 1000, 2000]},
        "loss"           : {"type": "categorical", "choices": ["mae", "mse", "huber"]},
    },
    "tft": {
        "hidden_size"  : {"type": "categorical", "choices": [32, 64, 128]},
        "lstm_layers"  : {"type": "int", "low": 1, "high": 3},
        "attn_heads"   : {"type": "categorical", "choices": [2, 4, 8]},
        "lr"           : {"type": "float", "low": 5e-5, "high": 1e-3, "log": True},
        "dropout"      : {"type": "float", "low": 0.0, "high": 0.4},
        "weight_decay" : {"type": "float", "low": 0.0, "high": 1e-3},
        "batch_size"   : {"type": "categorical", "choices": [64, 128, 256]},
        "max_steps"    : {"type": "categorical", "choices": [500, 1000, 2000]},
        "loss"         : {"type": "categorical", "choices": ["mae", "mse", "huber"]},
    },
    "dlinear": {
        "kernel_size"  : {"type": "int", "low": 5, "high": 55},
        "lr"           : {"type": "float", "low": 5e-5, "high": 5e-3, "log": True},
        "weight_decay" : {"type": "float", "low": 0.0, "high": 1e-3},
        "batch_size"   : {"type": "categorical", "choices": [128, 256, 512]},
        "max_steps"    : {"type": "categorical", "choices": [500, 1000, 2000]},
        "loss"         : {"type": "categorical", "choices": ["mae", "mse", "huber"]},
    },
}

# N-HiTS stack configurations: (pool_kernels, freq_downsamples)
NHITS_STACK_CONFIGS = [
    ([16,  8, 4], [24, 12,  1]),
    ([ 8,  4, 2], [24, 12,  1]),   # original default
    ([ 8,  4, 2], [12,  6,  1]),
    ([ 4,  2, 1], [24, 12,  1]),
    ([ 8,  4, 1], [48, 12,  1]),
    ([16,  4, 1], [24,  6,  1]),
]