# models/base.py
"""
BaseForecaster — interface chung cho tất cả models.
Mỗi model kế thừa class này và implement forward().
"""

import torch.nn as nn


class BaseForecaster(nn.Module):
    """
    Interface chuẩn:
      - forward(x) nhận (batch, input_size) → trả (batch, horizon)
      - model_name: string định danh để lưu checkpoint
    """
    model_name: str = "base"

    def forward(self, x):
        raise NotImplementedError

    def count_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)