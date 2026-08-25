#!/usr/bin/env python3
"""
Turn the boxing clip into the scroll-story's closing beat.

    python3 scripts/build-finale-sequence.py

Reads  assets/source/burger-boxing.mp4  (not served; kept only for rebuilds)
Writes public/finale-seq/{desktop,mobile}/f###.avif
       app/finaleFrames.ts

Unlike the burger sequence these frames are NOT cut out. The clip was rendered
on a flat studio backdrop, and the page fades its own background to exactly that
colour before this beat starts — so the frames can be drawn opaque with no
visible edge. That matters twice over: the box is navy on a navy backdrop and
would not difference-matte cleanly, and an opaque frame costs ~5 KB against
~44 KB for one carrying an alpha channel.

The burger's box in frame 0 is measured here and exported as `ANCHOR`, which is
what lets the page place this sequence so its opening frame lands exactly on top
of the burger the previous beat ended on.

Requires ffmpeg, avifenc (libavif) and numpy.
"""

import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/source/burger-boxing.mp4")
OUT = os.path.join(ROOT, "public/finale-seq")

DESKTOP_W, DESKTOP_Q, DESKTOP_N = 720, 52, 38
MOBILE_W, MOBILE_Q, MOBILE_N = 460, 48, 26
STILL_HOLD = 1.2          # frame-to-frame delta below this counts as a static hold


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")
    if not shutil.which("avifenc"):
        sys.exit("avifenc not found — install libavif")

    w, h = probe(SRC)
    with tempfile.TemporaryDirectory(prefix="finale-") as tmp:
        raw = os.path.join(tmp, "f.rgb")
        run(["ffmpeg", "-v", "error", "-i", SRC, "-pix_fmt", "rgb24", "-f", "rawvideo", raw])
        n = os.path.getsize(raw) // (w * h * 3)
        frames = np.memmap(raw, dtype=np.uint8, mode="r").reshape(n, h, w, 3)
        print(f"source {w}x{h}, {n} frames")

        # Trim the static hold the clip settles into once the lid is shut.
        deltas = np.array([np.abs(frames[i + 1].astype(np.int16)
                                  - frames[i].astype(np.int16)).mean()
                           for i in range(n - 1)])
        moving = np.nonzero(deltas > STILL_HOLD)[0]
        last = int(min(n - 1, moving.max() + 3)) if len(moving) else n - 1
        print(f"  motion ends at frame {last} (dropping {n - 1 - last} held frames)")

        # The clip's backdrop carries a faint gradient — a few units of blue
        # across the frame. The page can only match one flat colour, and the
        # mismatch shows as a rectangle around these opaque frames. Fit that
        # gradient and subtract it, which flattens the backdrop exactly while
        # shifting the subject by at most a unit or two.
        border = np.zeros((h, w), bool)
        border[:60] = border[-60:] = True
        border[:, :60] = border[:, -60:] = True
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
        basis = np.stack([xx, yy, np.ones_like(xx)], 2)
        sample = frames[0].astype(np.float64)
        plane = np.zeros((h, w, 3))
        design = basis[border]
        for c in range(3):
            coef, *_ = np.linalg.lstsq(design, sample[..., c][border], rcond=None)
            plane[..., c] = basis @ coef
        backdrop = np.median(plane.reshape(-1, 3), axis=0).round().astype(int)
        correction = (plane - backdrop).astype(np.float32)
        resid = np.abs(plane - sample)[border].mean()
        print(f"  backdrop rgb{tuple(backdrop)} (gradient fit residual {resid:.2f}/255, "
              f"span {np.ptp(plane.reshape(-1, 3), axis=0).round(1)})")

        # Where the burger sits in frame 0 — the handoff anchor. No box is in
        # frame yet, so a plain distance-from-backdrop threshold finds it.
        d = np.linalg.norm(sample - plane, axis=2)
        m = d > 26
        cols, rows = np.nonzero(m.any(0))[0], np.nonzero(m.any(1))[0]
        anchor = (cols.min() / w, rows.min() / h, (cols.max() + 1) / w, (rows.max() + 1) / h)
        print(f"  frame-0 burger anchor x {anchor[0]:.4f}..{anchor[2]:.4f} "
              f"y {anchor[1]:.4f}..{anchor[3]:.4f}")

        def emit(name, width, q, count):
            d_out = os.path.join(OUT, name)
            shutil.rmtree(d_out, ignore_errors=True)
            os.makedirs(d_out)
            idxs = [round(i * last / (count - 1)) for i in range(count)]
            total = 0
            for k, i in enumerate(idxs):
                png = os.path.join(d_out, f"f{k:03d}.png")
                avif = os.path.join(d_out, f"f{k:03d}.avif")
                flat = np.clip(frames[i].astype(np.float32) - correction, 0, 255)
                run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                     "-s", f"{w}x{h}", "-i", "pipe:0",
                     "-vf", f"scale={width}:{width}:flags=lanczos", "-update", "1", png],
                    input=flat.astype(np.uint8).tobytes())
                run(["avifenc", "-y", "420", "-q", str(q), "-s", "6", "-j", "all", png, avif],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                os.remove(png)
                total += os.path.getsize(avif)
            print(f"  {name}: {count} frames @ {width}sq -> {total / 1024:.0f} KB")

        os.makedirs(OUT, exist_ok=True)
        emit("desktop", DESKTOP_W, DESKTOP_Q, DESKTOP_N)
        emit("mobile", MOBILE_W, MOBILE_Q, MOBILE_N)

    with open(os.path.join(ROOT, "app/finaleFrames.ts"), "w") as fh:
        fh.write(f"""// GENERATED by scripts/build-finale-sequence.py — do not edit by hand.
// The closing beat: the burger settles into a Dinamo box and the lid shuts.

export const FINALE_DESKTOP_COUNT = {DESKTOP_N};
export const FINALE_MOBILE_COUNT = {MOBILE_N};

/**
 * The studio backdrop these frames were shot on. The page fades its own
 * background to this before the beat starts, which is what lets the frames be
 * drawn opaque without showing an edge.
 */
export const FINALE_BACKDROP = "rgb({backdrop[0]}, {backdrop[1]}, {backdrop[2]})";

/**
 * Where the burger sits inside frame 0, as fractions of the frame. The page
 * scales and offsets this sequence so that box lands exactly on the burger the
 * previous beat ended on, making the handoff invisible.
 */
export const FINALE_ANCHOR = {{
  left: {anchor[0]:.4f},
  top: {anchor[1]:.4f},
  right: {anchor[2]:.4f},
  bottom: {anchor[3]:.4f},
}};
""")
    print("wrote app/finaleFrames.ts")


if __name__ == "__main__":
    main()
