#!/usr/bin/env python3
"""
Turn the exploded-burger frame set into the scroll sequence the site scrubs.

    python3 scripts/build-frames.py

Reads  assets/source/burger-frames.zip   (30 PNGs, 1920x1080, not served)
Writes public/frames/{desktop,mobile}/f##.avif  (+ .webp fallbacks)
       public/frames/still-closed.{avif,webp}
       public/frames/still-apart.{avif,webp}
       src/frames.ts

The source frames have the studio backdrop baked in -- the PNG alpha channel is
fully opaque. But the backdrop never moves (measured: 2/255 mean drift across
all 30 frames), so the burger can be cut out by difference matting and the page
can own its own background instead of inheriting a 1920x1080 rectangle.

The matting technique (reconstructing the backdrop behind the subject, then
difference-keying against it) lives in matte.py, shared with
build-icecream.py. The burger never clears the middle of the frame, so a
plain per-pixel median can't recover the backdrop there — see matte.py for how
that is solved.

The subject uses about 16% of the frame's area, so cropping to it is worth
roughly 30x in pixels before any encoding.

Requires ffmpeg, avifenc (libavif) and numpy.
"""

import json
import os
import shutil
import sys
import zipfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matte import avif, build_plate, key, load  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/source/burger-frames.zip")
OUT = os.path.join(ROOT, "public/frames")

N_SRC = 30
SRC_W, SRC_H = 1920, 1080

# --- output shape -----------------------------------------------------------
DESKTOP_W, DESKTOP_Q = 560, 50
MOBILE_W, MOBILE_Q = 360, 46
# Mobile drops frames as well as pixels. 20 of 30 is safe because the canvas
# cross-dissolves between neighbours, so a coarser set reads as continuous
# motion rather than as steps -- see FrameCanvas.
MOBILE_N = 20

# --- the box the burger and its shadow never leave --------------------------
# Only used to decide which pixels are trustworthy background for the fit.
SUBJECT = (120, 960, 620, 1300)   # top, bottom, left, right

# Matte tuning is matte.key()'s defaults, tuned against this footage and left
# there since build-icecream.py's footage needed the same values. Override with
# explicit keyword args here if this burger clip is ever reshot and needs
# different ones — see matte.py for what each knob does.

# --- the five labelled ingredients, top to bottom ---------------------------
# This burger comes apart into: top bun / onion / tomato / cheese fused to the
# patty / lettuce / bottom bun. There is no pickle or sauce layer, and the cheese
# is draped over the patty rather than separating from it, so the labels are five
# and the middle one covers the whole vegetable group -- which is what the copy
# says anyway ("Svjeze povrce -- hrskava salata, paradajz i crveni luk").
N_LAYERS = 5

# The outline narrows into six masses: top bun / onion / tomato / cheese fused to
# the patty / lettuce / bottom bun. The onion and the tomato are one ingredient
# as far as the page is concerned, so they share a label and six masses become
# five. The build fails loudly if the footage stops giving sum(LAYER_GROUPS).
LAYER_GROUPS = (1, 2, 1, 1, 1)


def subject_rows(alpha, thr=0.35):
    """the burger's own rows, excluding the detached contact shadow below it"""
    on = (alpha > thr).any(1)
    runs, start = [], None
    for y, v in enumerate(on):
        if v and start is None:
            start = y
        if not v and start is not None:
            runs.append((start, y - 1))
            start = None
    if start is not None:
        runs.append((start, len(on) - 1))
    if not runs:
        sys.exit("no subject found in a frame")
    # the burger is the tallest run; the shadow is a short one further down
    return max(runs, key=lambda r: r[1] - r[0])


def necks(alpha, top, bot, want):
    """
    Split the burger into ingredient masses at the waists of its silhouette.

    These layers never fully separate -- even at full spread the outline stays
    continuous, so looking for empty rows between them finds nothing. What is
    always there is a *narrowing*: the profile of opaque width per row dips
    sharply between one ingredient and the next. Take the `want` deepest of
    those dips, measured by how far each falls below the widest point on either
    side of it, and the boundaries land on the real seams.
    """
    w = (alpha > 0.5).sum(1)[top:bot + 1].astype(float)
    k = 9
    sm = np.convolve(np.pad(w, k // 2, mode="edge"), np.ones(k) / k, "valid")

    cand = []
    for i in range(2, len(sm) - 2):
        if sm[i] <= sm[i - 1] and sm[i] <= sm[i + 1] and sm[i] < sm[i - 2] and sm[i] < sm[i + 2]:
            depth = min(sm[:i].max(), sm[i + 1:].max()) - sm[i]
            cand.append((depth, i))
    if len(cand) < want:
        sys.exit(f"expected {want} waists in the burger's outline, found {len(cand)}")
    cand.sort(reverse=True)
    cuts = sorted(i for _, i in cand[:want])

    edges = [0] + cuts + [len(sm) - 1]
    return [(top + edges[i], top + edges[i + 1]) for i in range(len(edges) - 1)]


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")
    if not shutil.which("avifenc"):
        sys.exit("avifenc not found — install libavif")

    zf = zipfile.ZipFile(SRC)
    print(f"source {SRC_W}x{SRC_H}, {N_SRC} frames")

    print("reconstructing the backdrop…")
    frames = [load(zf, i, SRC_W, SRC_H) for i in range(1, N_SRC + 1)]
    plate = build_plate(frames, SRC_W, SRC_H, SUBJECT)

    print(f"keying {N_SRC} frames…")
    keyed = [key(f, plate) for f in frames]
    del frames

    # crop to the union of every frame, so the burger never shifts in its box
    x0, y0, x1, y1 = SRC_W, SRC_H, 0, 0
    for _, a in keyed:
        m = a > 0.12
        cx, cy = np.nonzero(m.any(0))[0], np.nonzero(m.any(1))[0]
        x0, x1 = min(x0, cx.min()), max(x1, cx.max())
        y0, y1 = min(y0, cy.min()), max(y1, cy.max())
    x0, y0 = int(max(0, x0 - 10)), int(max(0, y0 - 10))
    x1, y1 = int(min(SRC_W - 1, x1 + 10)), int(min(SRC_H - 1, y1 + 10))
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    print(f"  crop {cw}x{ch} (aspect {cw / ch:.4f}), "
          f"{cw * ch / (SRC_W * SRC_H) * 100:.1f}% of the source area")

    # --- layer geometry -----------------------------------------------------
    # Measured on the last frame, where the burger is furthest apart and its
    # masses are most distinct; each layer keeps a fixed share of the overall
    # span, which is then read back against every frame's own span.
    apart = keyed[-1][1]
    a_top, a_bot = subject_rows(apart)
    masses = necks(apart, a_top, a_bot, sum(LAYER_GROUPS) - 1)
    six = [(s, e) for s, e in masses]
    grouped, at_i = [], 0
    for n in LAYER_GROUPS:
        grouped.append((six[at_i][0], six[at_i + n - 1][1]))
        at_i += n
    print("  layers:", ", ".join(f"{s}..{e}" for s, e in grouped))

    shares = [((s - a_top) / (a_bot - a_top), (e - a_top) / (a_bot - a_top))
              for s, e in grouped]

    layers = []
    for _, a in keyed:
        t, b = subject_rows(a)
        row = []
        for s_lo, s_hi in shares:
            lo = max(0, int(t + s_lo * (b - t)))
            hi = max(lo + 1, int(t + s_hi * (b - t)) + 1)
            strip = (a > 0.5)[lo:hi]
            xs = np.nonzero(strip.any(0))[0]
            left, right = (xs.min(), xs.max()) if len(xs) else (0, cw - 1)
            row.append([round(((lo + hi) / 2 - y0) / ch, 4),
                        round(float(left - x0) / cw, 4),
                        round(float(right - x0) / cw, 4)])
        layers.append(row)

    # --- encode -------------------------------------------------------------
    def emit(name, width, q, idxs):
        d = os.path.join(OUT, name)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        height = round(width * ch / cw / 2) * 2
        size = 0
        for n, i in enumerate(idxs):
            rgb, a = keyed[i]
            buf = np.dstack([rgb[y0:y1 + 1, x0:x1 + 1],
                             (a[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)]).tobytes()
            p = os.path.join(d, f"f{n:02d}.avif")
            avif(buf, cw, ch, width, height, q, p)
            size += os.path.getsize(p)
        print(f"  {name}: {len(idxs)} frames @ {width}x{height} -> {size / 1024:.0f} KB avif")
        return height

    os.makedirs(OUT, exist_ok=True)
    desktop = list(range(len(keyed)))
    mobile = [round(i * (len(keyed) - 1) / (MOBILE_N - 1)) for i in range(MOBILE_N)]
    dh = emit("desktop", DESKTOP_W, DESKTOP_Q, desktop)
    emit("mobile", MOBILE_W, MOBILE_Q, mobile)

    # stills for reduced motion — generated, never hand-made
    for name, i in (("still-closed", 0), ("still-apart", len(keyed) - 1)):
        rgb, a = keyed[i]
        buf = np.dstack([rgb[y0:y1 + 1, x0:x1 + 1],
                         (a[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)]).tobytes()
        avif(buf, cw, ch, DESKTOP_W, dh, 58, os.path.join(OUT, f"{name}.avif"), webp=True)
    print("  stills: still-closed, still-apart")

    with open(os.path.join(ROOT, "src/frames.ts"), "w") as fh:
        rows = ",\n".join("  [" + ", ".join(f"[{c}, {l}, {r}]" for c, l, r in row) + "]"
                          for row in layers)
        fh.write(f"""// GENERATED by scripts/build-frames.py — do not edit by hand.
// Geometry of the scroll sequence in public/frames/.

/** width / height of every frame */
export const ASPECT = {cw / ch:.5f};

export const DESKTOP_COUNT = {len(desktop)};
export const MOBILE_COUNT = {len(mobile)};

/** mobile frame i is a copy of desktop frame MOBILE_MAP[i] */
export const MOBILE_MAP: readonly number[] = {json.dumps(mobile)};

/** how many ingredients are labelled */
export const LAYER_COUNT = {N_LAYERS};

/**
 * Per frame, per labelled layer: [centreY, leftX, rightX] as fractions of the
 * frame box. Measured from the alpha at export time, which is what lets a label
 * sit level with its ingredient and run its rule up to that ingredient's edge.
 */
export const LAYER_GEOMETRY: readonly (readonly (readonly number[])[])[] = [
{rows},
];
""")
    print("wrote src/frames.ts")


if __name__ == "__main__":
    main()
