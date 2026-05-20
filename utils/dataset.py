# utils/dataset.py
"""PyTorch Dataset với profit-weighted sampling."""

import numpy as np
import torch
from torch.utils.data import Dataset


class WindowDataset(Dataset):
    """
    Random sliding-window sampler.
    sample_weights: nếu cung cấp, SKU có weight cao được sample nhiều hơn
    (giúp model tập trung vào SKU quan trọng theo profit).
    """
    def __init__(self, series: np.ndarray, input_size: int, horizon: int,
                 n_samples: int, sample_weights: np.ndarray = None):
        self.series     = series
        self.input_size = input_size
        self.horizon    = horizon
        self.n_samples  = n_samples
        self.num_series, self.time_len = series.shape
        self.max_start  = self.time_len - input_size - horizon

        if self.max_start < 0:
            raise ValueError(
                f"Series too short: time_len={self.time_len} < "
                f"input_size+horizon={input_size+horizon}")

        if sample_weights is not None:
            w = np.array(sample_weights, dtype=np.float64)
            w = np.where(w <= 0, 1e-3, w)   # zero-profit SKUs get minimum chance
            self.probs = w / w.sum()
        else:
            self.probs = None

    def __len__(self):
        return self.n_samples

    def __getitem__(self, _):
        s = (np.random.choice(self.num_series, p=self.probs)
             if self.probs is not None
             else np.random.randint(0, self.num_series))
        t = np.random.randint(0, self.max_start + 1)
        x = self.series[s, t : t + self.input_size]
        y = self.series[s, t + self.input_size : t + self.input_size + self.horizon]
        return torch.from_numpy(x.copy()), torch.from_numpy(y.copy())