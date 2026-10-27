"""Extract the two downloaded Natural Earth archives inside the task cache."""
from pathlib import Path
import sys
import zipfile

folder = Path(sys.argv[1] if len(sys.argv) > 1 else ".cache/geography")
for name in ("countries", "places"):
    destination = folder / name
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(folder / f"{name}.zip") as archive:
        if sum(info.file_size for info in archive.infolist()) > 100 * 1024 * 1024:
            raise ValueError("Archive exceeds the expected extraction allowance")
        for info in archive.infolist():
            if Path(info.filename).name != info.filename or info.is_dir():
                raise ValueError("Unexpected archive layout")
            (destination / info.filename).write_bytes(archive.read(info.filename))
print("Natural Earth archives extracted. Run npm run import:geography.")
