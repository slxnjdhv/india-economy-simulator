"""Copy the website's engine and calibration files into the Python package.

Run after changing prototype/engine.js or the calibration: python sync_engine.py
"""
import shutil
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parent
pkg = here / "src" / "indiasim" / "data"
pkg.mkdir(exist_ok=True)
for src in [root / "prototype" / "engine.js", root / "calibration" / "moments.js",
            root / "calibration" / "targets.json", root / "calibration" / "india-data.json"]:
    shutil.copy2(src, pkg / src.name)
    print("copied", src.relative_to(root))
