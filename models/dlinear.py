# models/dlinear.py
"""
DLinear: Are Transformers Effective for Time Series Forecasting?
Paper: https://arxiv.org/abs/2205.13504

Decompose series = Trend + Remainder, rồi dùng 2 linear layers riêng biệt.

Ưu điểm:
  • Cực kỳ nhanh — baseline mạnh, thường đánh bại Transformer
  • Ít overfit, tốt khi data ít
  • Tốt làm starting point hoặc ensemble component
"""

import torch
import torch.nn as nn
from models.base import BaseForecaster
from configs.config import INPUT_SIZE, HORIZON, MODEL_DEFAULTS


class MovingAvg(nn.Module):
    """Centered moving average để smooth trend."""
    def __init__(self, kernel_size: int):
        super().__init__()
        self.kernel_size = kernel_size
        self.avg = nn.AvgPool1d(kernel_size=kernel_size, stride=1, padding=0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, L)
        pad_l = (self.kernel_size - 1) // 2
        pad_r =  self.kernel_size // 2
        x_pad = torch.cat([x[:, :1].expand(-1, pad_l),
                            x,
                            x[:, -1:].expand(-1, pad_r)], dim=1)
        return self.avg(x_pad.unsqueeze(1)).squeeze(1)   # (B, L)


class DLinear(BaseForecaster):
    """
    DLinear forecaster.

    individual=True  → một Linear riêng cho mỗi series (tốt hơn nhưng cần nhiều RAM)
    individual=False → chia sẻ trọng số (default)
    """
    model_name = "dlinear"

    def __init__(self, input_size=INPUT_SIZE, horizon=HORIZON,
                 n_series: int = 1, **kwargs):
        super().__init__()
        cfg = {**MODEL_DEFAULTS["dlinear"], **kwargs}
        self.input_size = input_size
        self.horizon    = horizon
        self.individual = cfg["individual"]

        self.decomp = MovingAvg(cfg["kernel_size"])

        if self.individual:
            # One linear per series (input_size → horizon)
            self.trend_fc     = nn.ModuleList(
                [nn.Linear(input_size, horizon) for _ in range(n_series)])
            self.remainder_fc = nn.ModuleList(
                [nn.Linear(input_size, horizon) for _ in range(n_series)])
        else:
            self.trend_fc     = nn.Linear(input_size, horizon)
            self.remainder_fc = nn.Linear(input_size, horizon)

    def forward(self, x: torch.Tensor,
                series_idx: torch.Tensor = None) -> torch.Tensor:
        """
        x           : (B, input_size)
        series_idx  : (B,) int  — hanya diperlukan jika individual=True
        """
        trend     = self.decomp(x)
        remainder = x - trend

        if self.individual and series_idx is not None:
            # Slow path: iterate (used only if individual=True)
            fc_trend = torch.stack(
                [self.trend_fc[series_idx[i]](trend[i])
                 for i in range(x.size(0))])
            fc_rem   = torch.stack(
                [self.remainder_fc[series_idx[i]](remainder[i])
                 for i in range(x.size(0))])
        else:
            fc_trend = self.trend_fc(trend)
            fc_rem   = self.remainder_fc(remainder)

        return fc_trend + fc_rem   # (B, horizon)


def build_dlinear(params: dict = None, n_series: int = 1) -> DLinear:
    return DLinear(n_series=n_series, **(params or {}))