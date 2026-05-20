# models/nbeats.py
"""
N-BEATS: Neural Basis Expansion Analysis for Interpretable Time Series Forecasting
Paper: https://arxiv.org/abs/1905.10437

Kiến trúc gồm 2 loại stack:
  • TrendBlock    — basis là polynomial (bậc thấp) → học trend
  • SeasonBlock   — basis là Fourier harmonics → học seasonality
  • GenericBlock  — fully learned basis (không ràng buộc)

Ưu điểm:
  • Interpretable: có thể tách riêng trend và seasonality
  • Mạnh với dữ liệu có chu kỳ rõ ràng (daily retail)
"""

import numpy as np
import torch
import torch.nn as nn
from models.base import BaseForecaster
from configs.config import INPUT_SIZE, HORIZON, MODEL_DEFAULTS


# ── RevIN (dùng chung) ────────────────────────────────────────────────────────
class RevIN(nn.Module):
    def __init__(self, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.mean = self.std = None

    def normalize(self, x):
        self.mean = x.mean(dim=1, keepdim=True).detach()
        self.std  = (x.var(dim=1, keepdim=True, unbiased=False) + self.eps).sqrt().detach()
        return (x - self.mean) / self.std

    def denormalize(self, x):
        return x * self.std + self.mean


# ── Blocks ────────────────────────────────────────────────────────────────────

class _BlockBase(nn.Module):
    """Shared MLP backbone."""
    def __init__(self, input_size, horizon, hidden_size, n_layers, dropout=0.0):
        super().__init__()
        self.input_size = input_size
        self.horizon    = horizon
        layers, in_s = [], input_size
        for _ in range(n_layers):
            layers += [nn.Linear(in_s, hidden_size), nn.ReLU()]
            if dropout > 0:
                layers.append(nn.Dropout(dropout))
            in_s = hidden_size
        self.mlp = nn.Sequential(*layers)
        self.hidden_size = hidden_size


class TrendBlock(_BlockBase):
    """Polynomial basis expansion for trend."""
    def __init__(self, input_size, horizon, hidden_size, n_layers,
                 degree_of_poly=3, dropout=0.0):
        super().__init__(input_size, horizon, hidden_size, n_layers, dropout)
        p = degree_of_poly + 1
        self.fc_bc = nn.Linear(hidden_size, p)
        self.fc_fc = nn.Linear(hidden_size, p)

        # Fixed polynomial basis
        t_bc = torch.linspace(0, 1, input_size).unsqueeze(0)  # (1, T)
        t_fc = torch.linspace(0, 1, horizon).unsqueeze(0)
        basis_bc = torch.stack([t_bc ** i for i in range(p)], dim=1).squeeze(0)  # (p, T)
        basis_fc = torch.stack([t_fc ** i for i in range(p)], dim=1).squeeze(0)
        self.register_buffer("basis_bc", basis_bc)
        self.register_buffer("basis_fc", basis_fc)

    def forward(self, x):
        h  = self.mlp(x)
        bc = (self.fc_bc(h).unsqueeze(-1) * self.basis_bc).sum(dim=1)
        fc = (self.fc_fc(h).unsqueeze(-1) * self.basis_fc).sum(dim=1)
        return bc, fc


class SeasonBlock(_BlockBase):
    """Fourier basis expansion for seasonality."""
    def __init__(self, input_size, horizon, hidden_size, n_layers,
                 n_harmonics=4, dropout=0.0):
        super().__init__(input_size, horizon, hidden_size, n_layers, dropout)
        n_params = 2 * n_harmonics  # sin + cos
        self.fc_bc = nn.Linear(hidden_size, n_params)
        self.fc_fc = nn.Linear(hidden_size, n_params)

        def fourier_basis(length, n_h):
            t = torch.linspace(0, 1, length).unsqueeze(0)
            freqs = torch.arange(1, n_h + 1).unsqueeze(1).float()
            cos_b = torch.cos(2 * np.pi * freqs * t)   # (n_h, L)
            sin_b = torch.sin(2 * np.pi * freqs * t)
            return torch.cat([cos_b, sin_b], dim=0)     # (2*n_h, L)

        self.register_buffer("basis_bc", fourier_basis(input_size, n_harmonics))
        self.register_buffer("basis_fc", fourier_basis(horizon,     n_harmonics))

    def forward(self, x):
        h  = self.mlp(x)
        bc = (self.fc_bc(h).unsqueeze(-1) * self.basis_bc).sum(dim=1)
        fc = (self.fc_fc(h).unsqueeze(-1) * self.basis_fc).sum(dim=1)
        return bc, fc


class GenericBlock(_BlockBase):
    """Fully learned (unconstrained) basis."""
    def __init__(self, input_size, horizon, hidden_size, n_layers,
                 dropout=0.0):
        super().__init__(input_size, horizon, hidden_size, n_layers, dropout)
        self.fc_bc = nn.Linear(hidden_size, input_size)
        self.fc_fc = nn.Linear(hidden_size, horizon)

    def forward(self, x):
        h = self.mlp(x)
        return self.fc_bc(h), self.fc_fc(h)


# ── Main model ────────────────────────────────────────────────────────────────

class NBEATSInterpretable(BaseForecaster):
    """
    Interpretable N-BEATS: Trend stack → Seasonality stack → Generic stack.
    Outputs: backcast residuals cascade, summed forecasts.
    """
    model_name = "nbeats"

    def __init__(self, input_size=INPUT_SIZE, horizon=HORIZON, **kwargs):
        super().__init__()
        cfg = {**MODEL_DEFAULTS["nbeats"], **kwargs}
        self.input_size = input_size
        self.horizon    = horizon
        self.revin      = RevIN()

        block_kwargs = dict(
            input_size  = input_size,
            horizon     = horizon,
            hidden_size = cfg["hidden_size"],
            n_layers    = cfg["n_layers"],
            dropout     = cfg["dropout"],
        )

        # Build stacks: each stack = n_blocks of the same type
        stacks = []
        for _ in range(cfg["n_blocks"]):
            stacks.append(TrendBlock(**block_kwargs, degree_of_poly=cfg["degree_of_poly"]))
        for _ in range(cfg["n_blocks"]):
            stacks.append(SeasonBlock(**block_kwargs, n_harmonics=cfg["n_harmonics"]))
        for _ in range(cfg["n_blocks"]):
            stacks.append(GenericBlock(**block_kwargs))

        self.stacks = nn.ModuleList(stacks)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x        = self.revin.normalize(x)
        residual = x.clone()
        forecast = torch.zeros(x.size(0), self.horizon, device=x.device)
        for block in self.stacks:
            bc, fc   = block(residual)
            residual = residual - bc
            forecast = forecast + fc
        return self.revin.denormalize(forecast)


def build_nbeats(params: dict = None) -> NBEATSInterpretable:
    return NBEATSInterpretable(**(params or {}))