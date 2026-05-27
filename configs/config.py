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
# Biểu đồ EDA cho thấy structural break cuối 2021 → volume tăng 6-7x từ 2022.
# Dữ liệu trước 2022 sai scale, loại bỏ để tránh model học pattern cũ.
TRAIN_START_DATE = "2022-01-01"

# 182 = 26 tuần — bội số của 7 để align với weekly seasonality mạnh (Sun effect)
INPUT_SIZE  = 182
HORIZON     = 56    # 28 validation + 28 evaluation
VAL_STEPS   = 56    # = HORIZON — val set đúng 1 chu kỳ dự báo, không lãng phí data gần đây
GLOBAL_SEED = 42

# ── Training defaults (override bằng CLI hoặc Optuna) ────────────────────────
DEFAULT_BATCH_SIZE  = 256
DEFAULT_MAX_STEPS   = 5000
DEFAULT_LR          = 1e-3
DEFAULT_N_SEEDS_ENS = 3     # số seeds để ensemble lúc predict

# SKU có số ngày active <= ngưỡng này → forecast = 0 (quá thưa, không thể dự báo)
SPARSE_SKU_MIN_DAYS = 14

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
        "n_blocks"       : 4,
        "degree_of_poly" : 4,       # tăng lên 4 để bắt trend sau structural break
        "n_harmonics"    : 6,       # bắt chu kỳ 7/14/28 ngày (weekly effect mạnh)
        "dropout"        : 0.0,
        "loss"           : "mae",   # MAE phù hợp với heavy-tail distribution
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
    "lgbm": {
        "n_estimators"       : 300,
        "learning_rate"      : 0.05,
        "num_leaves"         : 63,
        "min_child_samples"  : 20,
        "subsample"          : 0.8,
        "colsample_bytree"   : 0.8,
        "max_windows_per_sku": 100,
        "loss"               : "mae",   # giữ cho nhất quán, không dùng bởi LightGBM
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
        "n_blocks"       : {"type": "int", "low": 2, "high": 6},
        "degree_of_poly" : {"type": "int", "low": 2, "high": 6},
        "n_harmonics"    : {"type": "int", "low": 4, "high": 12},  # tối thiểu 4 để bắt 7/14 ngày
        "lr"             : {"type": "float", "low": 5e-5, "high": 5e-3, "log": True},
        "dropout"        : {"type": "float", "low": 0.0, "high": 0.3},
        "weight_decay"   : {"type": "float", "low": 0.0, "high": 1e-3},
        "batch_size"     : {"type": "categorical", "choices": [128, 256, 512]},
        "max_steps"      : {"type": "categorical", "choices": [500, 1000, 2000, 3000]},
        "loss"           : {"type": "categorical", "choices": ["mae", "huber"]},  # bỏ mse, heavy-tail
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
    "lgbm": {
        "n_estimators"       : {"type": "categorical", "choices": [200, 300, 500]},
        "learning_rate"      : {"type": "float", "low": 0.01, "high": 0.2, "log": True},
        "num_leaves"         : {"type": "categorical", "choices": [31, 63, 127]},
        "min_child_samples"  : {"type": "int", "low": 10, "high": 50},
        "subsample"          : {"type": "float", "low": 0.6, "high": 1.0},
        "colsample_bytree"   : {"type": "float", "low": 0.6, "high": 1.0},
        "max_windows_per_sku": {"type": "categorical", "choices": [50, 100, 200]},
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