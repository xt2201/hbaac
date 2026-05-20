"""
HBAAC V6 full pipeline: preprocess → features V6 → ensemble + forecaster.
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"

parser = argparse.ArgumentParser()
parser.add_argument("--fast", action="store_true", help="3 LGBM seeds, skip heavy HPO")
parser.add_argument("--skip-train", action="store_true", help="Forecast only with saved models")
args = parser.parse_args()

steps = [
    ("preprocessor.py", "Data Preprocessing & WRMSSE Weights"),
    ("feature_builder_v6.py", "Feature Engineering V6"),
]

if not args.skip_train:
    steps.append(("train_ensemble.py", "Train V6 ensemble + auxiliary models"))

print("=" * 70)
print("HBAAC — V6 Pipeline")
print("=" * 70)

for step_num, (script, name) in enumerate(steps, start=1):
    if script == "train_ensemble.py":
        cmd = [sys.executable, str(ROOT / "scripts" / script)]
        if args.fast:
            cmd.append("--fast")
    else:
        cmd = [sys.executable, str(SRC / script)]

    print(f"\n{'=' * 70}")
    print(f"[{step_num}/{len(steps) + 1}] {name}")
    print(f"{'=' * 70}")
    t0 = time.time()
    result = subprocess.run(cmd, cwd=str(ROOT))
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"\nFAILED at step {step_num}: {name} (exit {result.returncode})")
        sys.exit(result.returncode)
    print(f"\nStep {step_num} complete in {elapsed:.1f}s")

# Forecaster
fcmd = [sys.executable, str(SRC / "forecaster_v6.py")]
if args.skip_train:
    fcmd.append("--skip-train")
if args.fast:
    fcmd.append("--fast")

print(f"\n{'=' * 70}")
print(f"[{len(steps) + 1}/{len(steps) + 1}] V6 Forecaster")
print(f"{'=' * 70}")
t0 = time.time()
result = subprocess.run(fcmd, cwd=str(ROOT))
if result.returncode != 0:
    sys.exit(result.returncode)
print(f"\nForecaster complete in {time.time() - t0:.1f}s")
print("\n" + "=" * 70)
print("V6 pipeline complete → submissions/submission_v6.csv")
print("=" * 70)
