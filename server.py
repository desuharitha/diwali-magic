"""Serve the greeting locally and encode deterministic canvas frames with FFmpeg."""
import argparse
from array import array
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
from urllib.parse import parse_qs, urlsplit
import wave

ROOT = Path(__file__).resolve().parent
FPS, RATE = 30, 24000
SHOW = json.loads((ROOT / "web" / "fireworks.json").read_text(encoding="utf-8"))
DURATION, FINALE_LENGTH = SHOW["filmDuration"], SHOW["finaleLength"]
MAX_BYTES = 768 * 1024 * 1024
ENCODE_SLOT = threading.BoundedSemaphore(1)


@lru_cache(maxsize=1)
def encoder():
    configured = os.getenv("FFMPEG")
    bundled = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "BlueStacks_nxt/ffmpeg.exe"
    executable = configured or shutil.which("ffmpeg") or (str(bundled) if bundled.is_file() else None)
    if not executable:
        return None, "Install FFmpeg and add it to PATH, or set the FFMPEG environment variable."
    try:
        info = subprocess.run([executable, "-hide_banner", "-encoders"], capture_output=True,
                              text=True, check=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None, "FFmpeg could not start. Check the FFMPEG path."
    for codec in ("libx264", "libopenh264"):
        if codec in info.stdout and " aac " in info.stdout:
            return (executable, codec), ""
    return None, "This FFmpeg build needs a software H.264 encoder and AAC."


@lru_cache(maxsize=1)
def soundtrack():
    """Mix the music and recorded effects on the film cue timeline."""
    notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 261.63,
             220, 261.63, 329.63, 392, 349.23, 329.63, 293.66, 220]
    samples = array("f", [0]) * (RATE * DURATION)

    def tone(at, duration, hz, level, decay):
        start = round(at * RATE)
        for i in range(min(round(duration * RATE), len(samples) - start)):
            t = i / RATE
            envelope = min(1, t * 80) * math.exp(-t * decay)
            samples[start + i] += level * envelope * math.sin(math.tau * hz * t)

    def chime(at, hz, level):
        tone(at, .38, hz, level, 10)
        tone(at + .018, .48, hz * 1.72, level * .34, 9)

    for i in range(math.ceil(DURATION / .56)):
        at = i * .56
        hz = notes[i % len(notes)]
        tone(at, 1.25, hz, .085, 3.8)
        tone(at, .72, hz * 2, .021, 6)
        if i % 4 == 0:
            tone(at, 2.4, hz / 2, .065, 1.6)
    for i in range(23):
        chime(1 + i * .27, 1020 + (i % 5) * 87, .023)
    for i, at in enumerate([9, 10.4, 11.8, 13.2, 14.6, 18.4, 26.5, 28.9, 30.6, 32.9, 35.3, 38.5]):
        chime(at, 870 + i * 61, .08)
    clips = {}
    for name in ("launch", "boom", "crackle"):
        with wave.open(str(ROOT / "web" / f"firework-{name}.wav"), "rb") as clip:
            assert (clip.getnchannels(), clip.getsampwidth(), clip.getframerate()) == (1, 2, RATE)
            clips[name] = array("h", clip.readframes(clip.getnframes()))
        if sys.byteorder != "little":
            clips[name].byteswap()

    def mix(name, at, level, pitch):
        clip = clips[name]
        start = round(at * RATE)
        for i in range(min(math.ceil((len(clip) - 1) / pitch), len(samples) - start)):
            pos = i * pitch
            base = int(pos)
            value = clip[base] + (clip[base + 1] - clip[base]) * (pos - base)
            samples[start + i] += value * level / 32768

    bursts = [(SHOW["exportStart"] + cue[0], *cue[1:]) for cue in SHOW["cues"]]
    bursts += [tuple(cue) for cue in SHOW["filmAmbient"]]
    bursts += [(SHOW["grandStart"] + cue[0], *cue[1:]) for cue in SHOW["closingVolley"]]
    for i, (at, _, _, depth, _, scale) in enumerate(bursts):
        level = .33 if depth == "far" else min(.86, .46 * scale)
        pitch = 1.08 if depth == "far" else .8 + (i % 4) * .07
        boom = at + SHOW["flight"]
        mix("launch", at, .19 * level, 1.34 + (i % 4) * .09)
        mix("boom", boom, .42 * level, pitch)
        if scale >= 1:
            mix("crackle", boom + .15, .18 * level, pitch + .18)
        if depth == "near":
            mix("boom", boom + .26, .075 * level, pitch * .83)
    pcm = array("h", (round(32767 * max(-1, min(1, v)) * min(1, i / (RATE * .4),
                (len(samples) - i) / RATE)) for i, v in enumerate(samples)))
    if sys.byteorder != "little":
        pcm.byteswap()
    return pcm.tobytes()


def encode(jpegs, target, width, duration, ffmpeg):
    executable, codec = ffmpeg
    audio = target.with_suffix(".wav")
    with wave.open(str(audio), "wb") as track:
        track.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        track.writeframes(soundtrack())
    length = FINALE_LENGTH if duration == "finale" else int(duration)
    audio_filter = f"atrim=start={DURATION - FINALE_LENGTH},asetpts=PTS-STARTPTS" if duration == "finale" else f"atempo={DURATION / length}"
    tuning = ["-preset", "fast", "-crf", "19"] if codec == "libx264" else ["-b:v", "14000k" if width == 2160 else "5200k"]
    subprocess.run([executable, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-f", "mjpeg", "-framerate", str(FPS), "-i", str(jpegs), "-i", str(audio),
                    "-map", "0:v:0", "-map", "1:a:0", "-frames:v", str(FPS * length),
                    "-vf", "format=yuv420p", "-af", audio_filter, "-t", str(length),
                    "-threads", "4", "-c:v", codec, *tuning,
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(target)],
                   capture_output=True, check=True, timeout=600)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web"), **kwargs)

    def allowed(self):
        host = self.headers.get("Host", "")
        accepted = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        origin = self.headers.get("Origin")
        return host in accepted and (origin is None or origin == "http://" + host)

    def reply(self, status, body, content_type="text/plain; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self.allowed():
            self.reply(403, "This server is for local use.")
        elif urlsplit(self.path).path == "/api/ready":
            ffmpeg, error = encoder()
            self.reply(200, json.dumps({"ready": bool(ffmpeg), "error": error}), "application/json")
        else:
            super().do_GET()

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, "This server is for local use.")
        url = urlsplit(self.path)
        if url.path != "/api/export":
            return self.reply(404, "Export endpoint not found.")
        if self.headers.get_content_type() != "application/octet-stream":
            return self.reply(415, "Expected the rendered video frames.")
        settings = parse_qs(url.query)
        width = settings.get("width", [""])[0]
        duration = settings.get("duration", ["47"])[0]
        length = self.headers.get("Content-Length", "")
        if width not in {"720", "1080", "2160"} or duration not in {"35", "47", "60", "finale"} or not length.isascii() or not length.isdecimal():
            return self.reply(400, "Invalid export settings.")
        remaining = int(length)
        if not 0 < remaining <= MAX_BYTES:
            return self.reply(413, "Export is too large. Try a smaller frame size or shorter film.")
        ffmpeg, error = encoder()
        if not ffmpeg:
            return self.reply(503, error)
        if not ENCODE_SLOT.acquire(blocking=False):
            return self.reply(429, "Another export is running. Try again when it finishes.")
        try:
            with tempfile.TemporaryDirectory(prefix="diwali-") as folder:
                frames = Path(folder) / "frames.mjpeg"
                target = Path(folder) / "diwali.mp4"
                self.connection.settimeout(90)
                with frames.open("wb") as file:
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            return self.reply(400, "The upload ended before all frames arrived.")
                        file.write(chunk)
                        remaining -= len(chunk)
                try:
                    encode(frames, target, int(width), duration, ffmpeg)
                except subprocess.CalledProcessError as exc:
                    print(exc.stderr.decode(errors="replace"), file=sys.stderr)
                    return self.reply(500, "FFmpeg could not encode the frames. See the local terminal.")
                except subprocess.TimeoutExpired:
                    return self.reply(504, "FFmpeg took too long. Try a lower resolution.")
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(target.stat().st_size))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with target.open("rb") as file:
                    shutil.copyfileobj(file, self.wfile)
        except (ConnectionError, TimeoutError):
            pass
        finally:
            ENCODE_SLOT.release()


def make_server(port=0):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with make_server(args.port) as server:
        print(f"Open http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
