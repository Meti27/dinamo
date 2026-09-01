#!/usr/bin/env python3
"""
Cut the Dinamo crest out of the source photo into a square, transparent logo.

    python3 scripts/build-logo.py

Reads  public/dinamo.jpg   (840x630, the crest on a mottled blue backdrop)
Writes public/dinamo-logo.webp, public/dinamo-logo.avif

The source is 4:3 with a photographic background, which is why the site used to
render it as an ellipse: a non-square image under `border-radius: 50%` is an
ellipse, not a circle. Cutting the crest to its own square with transparency
outside means it can be dropped on any background at any size without a
border-radius trick.

The crest is a gold-rimmed disc, so the ring is found by colour (warm, and much
warmer than the blue backdrop) and a circle is fitted to it.

Requires ffmpeg and numpy.
"""

import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/dinamo.jpg")
OUT = os.path.join(ROOT, "public/dinamo-logo")
SIZE = 512
FEATHER = 1.5   # px of edge softening, so the rim is not aliased


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", SRC],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(v) for v in probe.split(",")[:2])
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", SRC, "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"],
        capture_output=True, check=True).stdout
    img = np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32)

    # the gold rim is the warmest thing in the frame: red well above blue
    warm = (img[..., 0] - img[..., 2] > 40) & (img[..., 0] > 90)
    ys, xs = np.nonzero(warm)
    if len(xs) < 500:
        sys.exit("could not find the crest's gold rim")
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 3
    print(f"  crest centre ({cx:.0f},{cy:.0f}) radius {r:.0f} in {w}x{h}")

    # square crop around the crest, clamped inside the frame
    half = int(min(r + 6, cx, cy, w - cx, h - cy))
    x0, y0 = int(cx - half), int(cy - half)
    crop = img[y0:y0 + 2 * half, x0:x0 + 2 * half]
    n = crop.shape[0]

    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    dist = np.sqrt((xx - (cx - x0)) ** 2 + (yy - (cy - y0)) ** 2)
    alpha = np.clip((r - dist) / FEATHER + 0.5, 0, 1)

    rgba = np.dstack([crop.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    png = OUT + ".png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
                    "-s", f"{n}x{n}", "-i", "pipe:0",
                    "-vf", f"scale={SIZE}:{SIZE}:flags=lanczos", "-update", "1", png],
                   input=rgba.tobytes(), check=True)
    subprocess.run(["avifenc", "-y", "444", "-q", "62", "--qalpha", "70", "-s", "6",
                    "-j", "all", png, OUT + ".avif"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", png, "-c:v", "libwebp",
                    "-quality", "86", "-compression_level", "6", "-update", "1",
                    OUT + ".webp"], check=True)
    os.remove(png)
    for ext in ("avif", "webp"):
        print(f"  wrote public/dinamo-logo.{ext} "
              f"({os.path.getsize(OUT + '.' + ext) / 1024:.0f} KB, {SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
