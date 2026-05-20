# models/tft.py
"""
TFT-Lite: Temporal Fusion Transformer (simplified)
Original paper: https://arxiv.org/abs/1912.09363

Simplified version giữ lại các thành phần cốt lõi:
  • LSTM encoder (local pattern)
  • Multi-head self-attention (long-range dependency)
  • Gated residual connections (GRN)

Ưu điểm:
  • Tốt nhất cho long-range dependencies (ví dụ: annual seasonality)
  • Xử lý tốt dữ liệu có nhiều SKU với pattern khác nhau
  • Khả năng capture non-linear interactions cao nhất

Nhược điểm:
  • Chậm hơn N-HiTS / DLinear ~3-5x
  • Cần nhiều data để converge tốt
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from models.base import BaseForecaster
from configs.config import INPUT_SIZE, HORIZON, MODEL_DEFAULTS


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


class GatedResidualNetwork(nn.Module):
    """GRN: core building block of TFT."""
    def __init__(self, input_size: int, hidden_size: int,
                 output_size: int = None, dropout: float = 0.0):
        super().__init__()
        output_size = output_size or input_size
        self.fc1   = nn.Linear(input_size,  hidden_size)
        self.fc2   = nn.Linear(hidden_size, output_size)
        self.gate  = nn.Linear(hidden_size, output_size)
        self.norm  = nn.LayerNorm(output_size)
        self.drop  = nn.Dropout(dropout)
        self.skip  = (nn.Linear(input_size, output_size)
                      if input_size != output_size else nn.Identity())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h    = F.elu(self.fc1(x))
        h    = self.drop(h)
        val  = self.fc2(h)
        gate = torch.sigmoid(self.gate(h))
        return self.norm(gate * val + self.skip(x))


class TFTLite(BaseForecaster):
    """
    Simplified TFT:
      (1) Project scalar input → embedding
      (2) LSTM encoder (captures local temporal patterns)
      (3) Multi-head self-attention (captures long-range patterns)
      (4) GRN output head → horizon
    """
    model_name = "tft"

    def __init__(self, input_size=INPUT_SIZE, horizon=HORIZON, **kwargs):
        super().__init__()
        cfg = {**MODEL_DEFAULTS["tft"], **kwargs}
        self.input_size  = input_size
        self.horizon     = horizon
        H  = cfg["hidden_size"]
        nh = cfg["attn_heads"]
        nl = cfg["lstm_layers"]
        dr = cfg["dropout"]

        self.revin  = RevIN()

        # (1) Input projection: scalar → H-dim embedding
        self.input_proj = nn.Linear(1, H)

        # (2) LSTM encoder
        self.lstm = nn.LSTM(
            input_size  = H,
            hidden_size = H,
            num_layers  = nl,
            batch_first = True,
            dropout     = dr if nl > 1 else 0.0,
        )
        self.lstm_norm = nn.LayerNorm(H)

        # (3) Multi-head self-attention
        self.attn      = nn.MultiheadAttention(H, nh, dropout=dr, batch_first=True)
        self.attn_norm = nn.LayerNorm(H)

        # (4) GRN → forecast
        self.grn_out = GatedResidualNetwork(H, H * 2, H, dropout=dr)
        self.fc_out  = nn.Linear(H, horizon)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, input_size)
        x = self.revin.normalize(x)

        # (1) Embed
        emb = self.input_proj(x.unsqueeze(-1))   # (B, T, H)

        # (2) LSTM
        lstm_out, _ = self.lstm(emb)              # (B, T, H)
        lstm_out    = self.lstm_norm(lstm_out + emb)

        # (3) Self-attention
        attn_out, _ = self.attn(lstm_out, lstm_out, lstm_out)
        attn_out    = self.attn_norm(attn_out + lstm_out)

        # (4) Pool last step → GRN → forecast
        ctx      = attn_out[:, -1, :]             # (B, H) — last time step
        ctx_grn  = self.grn_out(ctx)
        forecast = self.fc_out(ctx_grn)           # (B, horizon)

        return self.revin.denormalize(forecast)


def build_tft(params: dict = None) -> TFTLite:
    return TFTLite(**(params or {}))