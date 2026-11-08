"""Export Diwali MP4s from a UTF-8 CSV with From and To columns."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unicodedata

from server import ROOT, encoder, make_server


def browser_path():
    candidates = [os.getenv("CHROME"), shutil.which("chrome"), shutil.which("chromium"),
                  shutil.which("google-chrome"), shutil.which("msedge"),
                  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    for env in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        if base := os.getenv(env):
            candidates.extend([Path(base) / "Google/Chrome/Application/chrome.exe",
                               Path(base) / "Microsoft/Edge/Application/msedge.exe"])
    return next((str(p) for p in candidates if p and Path(p).is_file()), None)


def slug(name):
    return "_".join("".join(c if c.isalnum() or unicodedata.category(c).startswith("M")
                           or c == "-" else " " for c in unicodedata.normalize("NFC", name)).split()) or "Name"


def read_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = {key.strip().lower(): key for key in (reader.fieldnames or [])}
        if not {"from", "to"} <= headers.keys():
            raise ValueError("CSV needs From and To column headers.")
        for row in reader:
            names = tuple((row[headers[key]] or "").strip() for key in ("from", "to"))
            if any(not name or len(name.encode("utf-16-le")) > 80 for name in names):
                raise ValueError(f"Line {reader.line_num} needs two names of 1–40 characters.")
            yield names


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path, default=Path("videos"))
    parser.add_argument("--width", "--height", type=int, choices=(720, 1080, 2160), default=1080)
    parser.add_argument("--duration", choices=("35", "47", "60", "finale"), default="47")
    args = parser.parse_args()
    try:
        pairs = list(dict.fromkeys(read_rows(args.csv)))
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    if not pairs:
        parser.error("The CSV has no greetings.")
    chrome = browser_path()
    node = shutil.which("node")
    if not chrome or not node:
        parser.error("Batch rendering needs Node.js 22+ and Chrome, Chromium or Edge. Set CHROME if needed.")
    ffmpeg, error = encoder()
    if not ffmpeg:
        parser.error(error)
    version = hashlib.sha256()
    for file in ("server.py", "web/art.js", "web/app.js", "web/fireworks.json", "web/fireworks.json"):
        version.update((ROOT / file).read_bytes())
    version.update(subprocess.check_output([ffmpeg[0], "-version"]).splitlines()[0])
    version.update(str(Path(chrome).stat().st_mtime_ns).encode())
    destination = args.output.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    cache = destination / ".diwali-cache"
    cache.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="diwali-batch-", dir=cache) as temp:
        queue, completed, used = [], [], set()
        for sender, recipient in pairs:
            key = version.copy()
            key.update(json.dumps([sender, recipient, args.width, args.duration]).encode())
            digest = key.hexdigest()
            cached = cache / (digest + ".mp4")
            stem = f"Diwali_{slug(recipient)}_From_{slug(sender)}"
            if args.duration == "finale":
                stem += "_Finale"
            output = destination / (stem + ".mp4")
            if output.name.casefold() in used:
                output = destination / (stem + "_" + digest[:8] + ".mp4")
            used.add(output.name.casefold())
            scratch = Path(temp) / (digest + ".mp4")
            if not cached.is_file():
                queue.append({"from": sender, "to": recipient, "path": str(scratch)})
            completed.append((scratch, cached, output))
        if queue:
            with make_server() as server:
                worker = threading.Thread(target=server.serve_forever, daemon=True)
                worker.start()
                try:
                    subprocess.run([node, str(ROOT / "batch-render.mjs"), chrome,
                                    f"http://127.0.0.1:{server.server_port}", str(args.width), args.duration],
                                   input=json.dumps(queue), text=True, check=True)
                finally:
                    server.shutdown()
                    worker.join()
        for scratch, cached, output in completed:
            if scratch.is_file():
                scratch.replace(cached)
            staged = Path(temp) / output.name
            shutil.copyfile(cached, staged)
            staged.replace(output)
            print(output)


if __name__ == "__main__":
    main()
