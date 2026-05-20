# models/nhits.py
"""
N-HiTS: Neural Hierarchical Interpolation for Time Series Forecasting
Paper: https://arxiv.org/abs/2201.12886

Ưu điểm:
  • Multi-scale pooling → tốt cho intermittent/sporadic demand
  • RevIN xử lý non-stationary series (SKU mới, SKU theo mùa)
  • Nhanh và nhẹ hơn TFT
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from models.base import BaseForecaster
from configs.config import INPUT_SIZE, HORIZON, MODEL_DEFAULTS


class RevIN(nn.Module):
    """Reversible Instance Normalization — per-series mean/std."""
    def __init__(self, eps: float = 1e-5):
        super().__init__()
        self.eps  = eps
        self.mean = self.std = None

    def normalize(self, x: torch.Tensor) -> torch.Tensor:
        self.mean = x.mean(dim=1, keepdim=True).detach()
        self.std  = (x.var(dim=1, keepdim=True, unbiased=False) + self.eps).sqrt().detach()
        return (x - self.mean) / self.std

    def denormalize(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.std + self.mean


class NHITSBlock(nn.Module):
    def __init__(self, input_size, horizon, hidden_size, n_layers,
                 pool_kernel, freq_downsample, dropout=0.0):
        super().__init__()
        self.input_size = input_size
        self.horizon    = horizon

        self.pool   = nn.MaxPool1d(pool_kernel, stride=pool_kernel, ceil_mode=True)
        pooled_size = (input_size + pool_kernel - 1) // pool_kernel

        layers, in_size = [], pooled_size
        for _ in range(n_layers):
            layers += [nn.Linear(in_size, hidden_size), nn.ReLU()]
            if dropout > 0:
                layers.append(nn.Dropout(dropout))
            in_size = hidden_size
        self.mlp = nn.Sequential(*layers)

        self.backcast_head = nn.Linear(hidden_size, max(input_size // freq_downsample, 1))
        self.forecast_head = nn.Linear(hidden_size, max(horizon    // freq_downsample, 1))

    def forward(self, x):
        xp = self.pool(x.unsqueeze(1)).squeeze(1)
        h  = self.mlp(xp)
        bc = F.interpolate(self.backcast_head(h).unsqueeze(1),
                           size=self.input_size, mode="linear",
                           align_corners=False).squeeze(1)
        fc = F.interpolate(self.forecast_head(h).unsqueeze(1),
                           size=self.horizon, mode="linear",
                           align_corners=False).squeeze(1)
        return bc, fc


class NHiTS(BaseForecaster):
    model_name = "nhits"

    def __init__(self, input_size=INPUT_SIZE, horizon=HORIZON, **kwargs):
        super().__init__()
        cfg = {**MODEL_DEFAULTS["nhits"], **kwargs}
        self.input_size = input_size
        self.horizon    = horizon
        self.revin      = RevIN()
        self.blocks     = nn.ModuleList([
            NHITSBlock(input_size, horizon,
                       cfg["hidden_size"], cfg["n_layers"],
                       pk, fd, cfg["dropout"])
            for pk, fd in zip(cfg["pool_kernels"], cfg["freq_downsamples"])
        ])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x        = self.revin.normalize(x)
        residual = x.clone()
        forecast = torch.zeros(x.size(0), self.horizon, device=x.device)
        for block in self.blocks:
            bc, fc   = block(residual)
            residual = residual - bc
            forecast = forecast + fc
        return self.revin.denormalize(forecast)


def build_nhits(params: dict = None) -> NHiTS:
    """Factory — dùng trong train.py và optuna_search.py."""
    return NHiTS(**(params or {}))