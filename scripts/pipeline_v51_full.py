"""
V5.1 full pipeline from scratch: preprocess → features → Optuna tune → forecast.

Optuna hyperparams saved to:
  processed/v51_optuna.db
  processed/v51_optuna_best.json
  processed/v51_optuna_trials.jsonl
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
PY = sys.executable

steps = [
    ([PY, str(SRC / "preprocessor.py")], "Preprocessor"),
    ([PY, str(SRC / "feature_builder.py")], "Feature builder"),
    (
        [PY, str(ROOT / "scripts" / "tune_v51.py"), "--optuna-trials", "35", "--fresh"],
        "Optuna + post-process tune + forecast",
    ),
]

print("=" * 70)
print("HBAAC — V5.1 full pipeline (from scratch)")
print("=" * 70)

for i, (cmd, name) in enumerate(steps, 1):
    print(f"\n{'=' * 70}\n[{i}/{len(steps)}] {name}\n{'=' * 70}")
    t0 = time.time()
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        print(f"\nFAILED: {name} (exit {r.returncode})")
        sys.exit(r.returncode)
    print(f"\nDone in {time.time() - t0:.1f}s")

print("\n" + "=" * 70)
print("Complete → submissions/submission_v51.csv")
print("Optuna → processed/v51_optuna_best.json")
print("=" * 70)
