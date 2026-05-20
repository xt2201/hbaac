import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"

steps = [
    ("preprocessor.py", "Data Preprocessing & WRMSSE Weights"),
    ("feature_builder.py", "Feature Engineering V5 (EDA-driven)"),
    ("forecaster.py", "V5 Model Training, Forecast & Submission"),
]

print("=" * 70)
print("HBAAC — Professional Pipeline")
print("=" * 70)

for step_num, (script, name) in enumerate(steps, start=1):
    print(f"\n{'='*70}")
    print(f"[{step_num}/{len(steps)}] Running: {name}")
    print(f"{'='*70}")
    t0 = time.time()

    result = subprocess.run(
        [sys.executable, str(SRC / script)],
        cwd=str(ROOT),
    )

    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"\n❌ FAILED at step {step_num}: {name} (exit code {result.returncode})")
        sys.exit(result.returncode)
    else:
        print(f"\n✓ Step {step_num} complete in {elapsed:.1f}s")

print("\n" + "="*70)
print("✅ Pipeline complete! Final submission is in submissions/")
print("="*70)