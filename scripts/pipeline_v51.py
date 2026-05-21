"""
V5.1 pipeline: same as V5 but expanded ALL_HOLIDAYS (vn_calendar v2) + submission_v51.csv.

Prerequisites: dataset/train.csv, run preprocessor once if sku_weights.csv missing.
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"

steps = [
    ("preprocessor.py", "Data Preprocessing & WRMSSE Weights"),
    ("feature_builder.py", "Feature Engineering (panel; holidays applied in forecaster)"),
    (("forecaster.py", "--tag", "v51"), "V5.1 Train, Forecast & submission_v51.csv"),
]

print("=" * 70)
print("HBAAC — V5.1 Pipeline (expanded calendar holidays)")
print("=" * 70)

for step_num, step in enumerate(steps, start=1):
    if isinstance(step[0], tuple):
        script_parts, name = step[0], step[1]
        cmd = [sys.executable, str(SRC / script_parts[0]), *script_parts[1:]]
    else:
        script, name = step[0], step[1]
        cmd = [sys.executable, str(SRC / script)]

    print(f"\n{'=' * 70}")
    print(f"[{step_num}/{len(steps)}] {name}")
    print(f"{'=' * 70}")
    t0 = time.time()
    result = subprocess.run(cmd, cwd=str(ROOT))
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"\nFAILED at step {step_num}: {name} (exit {result.returncode})")
        sys.exit(result.returncode)
    print(f"\nStep {step_num} done in {elapsed:.1f}s")

print("\n" + "=" * 70)
print("V5.1 complete → submissions/submission_v51.csv")
print("=" * 70)
