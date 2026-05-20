# Forecast Project — WRMSSE Competition

```
forecast_project/
├── data/                    ← đặt train.csv, sample_submission.csv vào đây
├── configs/
│   └── config.py            ← tất cả hằng số & hyperparameter defaults
├── utils/
│   ├── data_loader.py       ← load, parse, pivot data
│   ├── dataset.py           ← WindowDataset (PyTorch)
│   └── metrics.py           ← RMSSE, WRMSSE
├── models/
│   ├── base.py              ← BaseForecaster interface
│   ├── nhits.py             ← N-HiTS
│   ├── nbeats.py            ← N-BEATS
│   ├── tft.py               ← Temporal Fusion Transformer (lite)
│   └── dlinear.py           ← DLinear (linear baseline)
├── train.py                 ← train một model cụ thể
├── optuna_search.py         ← hyperparameter search (chọn model)
└── predict.py               ← tạo submission từ checkpoint đã train
```

## Cài đặt

```bash
pip install torch optuna pandas numpy
```

## Workflow

### 1. Train nhanh (không tuning)
```bash
python train.py --model nhits --steps 1000
python train.py --model nbeats --steps 1000
python train.py --model dlinear --steps 500
python train.py --model tft --steps 1000
```

### 2. Optuna hyperparameter search
```bash
# Tìm best params cho một model
python optuna_search.py --model nhits --trials 50
python optuna_search.py --model nbeats --trials 50

# Tìm best params + so sánh tất cả models
python optuna_search.py --model all --trials 30
```

### 3. Tạo submission từ checkpoint tốt nhất
```bash
python predict.py --model nhits
python predict.py --model nhits --ensemble 5   # ensemble 5 seeds
```

## Models

| Model | Đặc điểm | Tốc độ |
|-------|-----------|--------|
| **DLinear** | Linear decomposition, rất nhanh, baseline mạnh | ⚡⚡⚡ |
| **N-BEATS** | Basis expansion, interpretable (trend + seasonality) | ⚡⚡ |
| **N-HiTS** | Multi-scale pooling, tốt cho intermittent demand | ⚡⚡ |
| **TFT-Lite** | Attention + LSTM, tốt nhất nhưng chậm nhất | ⚡ |