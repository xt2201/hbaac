# models/lgbm.py
"""
LightGBM forecaster với lag features.

Direct multi-step: train 1 LGBMRegressor mỗi horizon step.

Features từ window (input_size ngày gần nhất):
  - Lag: ngày t-1 .. t-14, t-21, t-28, t-35, t-42, t-49, t-56
  - Rolling mean / std / max: cửa sổ 7, 14, 28, 56, 182 ngày
  - Linear trend slope: 14, 28, 56 ngày gần nhất

Interface tương thích với evaluate_model và predict.py
(có .eval(), .to(), __call__ trả về torch.Tensor).
"""

import numpy as np
import torch
import lightgbm as lgb

from configs.config import INPUT_SIZE, HORIZON

LAG_DAYS     = list(range(1, 15)) + [21, 28, 35, 42, 49, 56]
ROLL_WINDOWS = [7, 14, 28, 56, 182]
TREND_WINS   = [14, 28, 56]


def _make_features(windows: np.ndarray) -> np.ndarray:
    """
    windows : (N, input_size) float32
    Returns : (N, n_features) float32
    """
    N, T = windows.shape
    parts = []

    # Lag features
    for l in LAG_DAYS:
        col = windows[:, -l] if l <= T else np.zeros(N, dtype=np.float32)
        parts.append(col.reshape(-1, 1))

    # Rolling statistics
    for w in ROLL_WINDOWS:
        sl = windows[:, -min(w, T):]
        parts.append(sl.mean(axis=1, keepdims=True))
        parts.append(sl.std(axis=1,  keepdims=True))
        parts.append(sl.max(axis=1,  keepdims=True))

    # Linear trend slope
    for w in TREND_WINS:
        sl = windows[:, -min(w, T):].astype(np.float64)
        x  = np.arange(sl.shape[1], dtype=np.float64)
        x -= x.mean()
        denom = (x ** 2).sum() or 1.0
        slope = ((sl * x).sum(axis=1) / denom).astype(np.float32)
        parts.append(slope.reshape(-1, 1))

    return np.concatenate(parts, axis=1).astype(np.float32)


_N_FEATURES = len(LAG_DAYS) + len(ROLL_WINDOWS) * 3 + len(TREND_WINS)

_DEFAULT_LGBM = {
    "n_estimators"     : 300,
    "learning_rate"    : 0.05,
    "num_leaves"       : 63,
    "min_child_samples": 20,
    "subsample"        : 0.8,
    "colsample_bytree" : 0.8,
    "n_jobs"           : -1,
    "verbose"          : -1,
}


class LGBMForecaster:
    """
    Tương thích với evaluate_model (torch interface) và predict.py.
    """

    def __init__(self, horizon: int = HORIZON, lgbm_params: dict = None,
                 random_state: int = 42):
        self.horizon      = horizon
        self.random_state = random_state
        self.lgbm_params  = {**_DEFAULT_LGBM, **(lgbm_params or {})}
        self.models: list = []

    def fit(self, train_series: np.ndarray, profit_weights: np.ndarray,
            max_windows_per_sku: int = 100, verbose: bool = True):
        """Tạo tabular dataset và train 1 model mỗi horizon step."""
        T      = train_series.shape[1]
        active = np.where(profit_weights > 0)[0]

        if verbose:
            print(f"  LightGBM: tạo windows từ {len(active):,} active SKUs ...")

        X_list, Y_list, W_list = [], [], []
        for idx in active:
            s = train_series[idx].astype(np.float32)
            w = float(profit_weights[idx])

            max_t = T - self.horizon
            if max_t < INPUT_SIZE:
                continue

            starts = list(range(INPUT_SIZE, max_t + 1))
            if len(starts) > max_windows_per_sku:
                starts = starts[-max_windows_per_sku:]   # ưu tiên gần nhất

            for t in starts:
                X_list.append(s[t - INPUT_SIZE : t])
                Y_list.append(s[t : t + self.horizon])
                W_list.append(w)

        X = np.array(X_list, dtype=np.float32)
        Y = np.array(Y_list, dtype=np.float32)
        W = np.array(W_list, dtype=np.float64)
        W = W / W.mean()

        X_feat = _make_features(X)
        if verbose:
            print(f"  Samples: {len(X):,} | Features: {X_feat.shape[1]}")

        self.models = []
        for h in range(self.horizon):
            if verbose and (h == 0 or (h + 1) % 14 == 0 or h == self.horizon - 1):
                print(f"  Training step {h+1}/{self.horizon} ...")
            m = lgb.LGBMRegressor(
                **self.lgbm_params,
                random_state=self.random_state + h,
            )
            m.fit(X_feat, Y[:, h], sample_weight=W)
            self.models.append(m)

        return self

    # ── Inference ─────────────────────────────────────────────────────────────

    def __call__(self, x: torch.Tensor) -> torch.Tensor:
        """x: (N, input_size) tensor  →  (N, horizon) tensor"""
        feat  = _make_features(x.cpu().numpy().astype(np.float32))
        preds = np.stack([m.predict(feat) for m in self.models], axis=1)
        return torch.from_numpy(np.clip(preds, 0, None).astype(np.float32))

    # ── Compatibility stubs ────────────────────────────────────────────────────
    def eval(self):       return self
    def train(self):      return self
    def to(self, device): return self
    def parameters(self): return iter([])

    def state_dict(self):
        import pickle
        return {
            "lgbm_models" : pickle.dumps(self.models),
            "lgbm_params" : self.lgbm_params,
            "horizon"     : self.horizon,
            "random_state": self.random_state,
        }

    def load_state_dict(self, d: dict):
        import pickle
        self.models       = pickle.loads(d["lgbm_models"])
        self.lgbm_params  = d.get("lgbm_params",  self.lgbm_params)
        self.horizon      = d.get("horizon",       self.horizon)
        self.random_state = d.get("random_state",  self.random_state)
        return self


def build_lgbm(params: dict) -> LGBMForecaster:
    _skip = {"loss", "max_windows_per_sku"}
    lgbm_p = {k: v for k, v in params.items() if k not in _skip}
    return LGBMForecaster(lgbm_params=lgbm_p or None)
