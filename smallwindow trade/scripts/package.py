"""Build the unpacked Chrome extension ZIP without third-party dependencies."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "manifest.json").read_text())
files = ["manifest.json", "app.html", "app.js", "core.js", "styles.css",
         "background.js", "overlay.js", "README.md", *manifest["icons"].values()]
for name in files:
    if not (root / name).is_file():
        raise SystemExit(f"Missing runtime file: {name}")
output = root / "dist" / "smallwindow-trade.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, Path("smallwindow trade") / name)
with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit("Archive integrity check failed")
print(f"Packaged v{manifest['version']}: {output.name} ({output.stat().st_size:,} bytes)")
