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

The catch is that the burger never clears the middle of the frame, so a
per-pixel median recovers the backdrop everywhere *except* exactly where it is
needed. The backdrop is a smooth gradient with a vignette, so a low-order
surface is fitted to the pixels outside the box the burger and its shadow never
leave, and used to predict the rest. Measured: the fit reproduces known
background at 1.70/255, and a strip it had to extrapolate at 1.68/255 -- so
extrapolating across the burger is as accurate as interpolating.

The subject uses about 16% of the frame's area, so cropping to it is worth
roughly 30x in pixels before any encoding.

Requires ffmpeg, avifenc (libavif) and numpy.
"""

import json
import os
import shutil
import subprocess
import sys
import zipfile

import numpy as np

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

# --- matte tuning -----------------------------------------------------------
OBJ_LO, OBJ_HI = 16.0, 44.0   # object knee, as RGB distance from the backdrop
BG_HUE_TOL = 0.10             # per-channel ratio spread that still reads as backdrop
SHADOW_HI, SHADOW_LO = 0.985, 0.55
SHADOW_STRENGTH = 0.70
SHADOW_RGB = np.array([13.0, 10.0, 9.0], np.float32)
# The surface fit leaves ~1.7/255 of residual, which becomes a faint haze of very
# low alpha across the whole frame. Without a floor the crop below expands to the
# entire 1920x1080 and the whole point of cropping is lost.
ALPHA_FLOOR = 0.10

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


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def load(zf, i):
    """decode one PNG straight from the archive, no extraction"""
    data = zf.read(f"{i:02d}.png")
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-pix_fmt", "rgb24",
         "-f", "rawvideo", "pipe:1"],
        input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(SRC_H, SRC_W, 3).astype(np.float64)


def build_plate(frames):
    """reconstruct the backdrop, including behind the burger"""
    med = np.median(np.stack(frames), 0)
    t, b, l, r = SUBJECT
    known = np.ones((SRC_H, SRC_W), bool)
    known[t:b, l:r] = False

    yy, xx = np.mgrid[0:SRC_H, 0:SRC_W].astype(np.float64)
    ny, nx = yy / SRC_H, xx / SRC_W
    basis = np.stack([np.ones_like(nx), nx, ny, nx * nx, ny * ny, nx * ny,
                      nx * nx * ny, nx * ny * ny, ny ** 3, nx ** 3], -1)

    plate = np.zeros((SRC_H, SRC_W, 3))
    for c in range(3):
        coef, *_ = np.linalg.lstsq(basis[known], med[..., c][known], rcond=None)
        plate[..., c] = basis @ coef

    resid = np.abs(plate - med)[known]
    # a strip inside the box that is still background, so it tests extrapolation
    probe = np.zeros((SRC_H, SRC_W), bool)
    probe[t + 20:t + 80, l + 20:r - 20] = True
    print(f"  backdrop fit: known {resid.mean():.2f}/255 mean, "
          f"{np.percentile(resid, 99):.2f} p99 | extrapolated "
          f"{np.abs(plate - med)[probe].mean():.2f}/255")
    if resid.mean() > 4.0:
        sys.exit("backdrop fit is too poor to matte against — has the footage changed?")
    return plate


def boxmean(mask, r):
    p = np.pad(mask.astype(np.float32), r + 1)
    ii = p.cumsum(0).cumsum(1)
    h, w = mask.shape
    k = 2 * r + 1
    return (ii[k:k + h, k:k + w] + ii[:h, :w] - ii[k:k + h, :w] - ii[:h, k:k + w]) / (k * k)


def key(frame, plate):
    """difference matte -> (rgb, alpha), keeping the contact shadow"""
    f = frame.astype(np.float32)
    p = plate.astype(np.float32)
    dist = np.sqrt(((f - p) ** 2).sum(2))
    ratio = (f + 3.0) / (p + 3.0)

    # A near-constant per-channel ratio means the backdrop itself got darker --
    # the shadow the burger casts on it. That is not the burger, but it is not
    # nothing either, so it earns partial alpha and its own near-black colour.
    backdrop = ratio.std(2) < BG_HUE_TOL
    shadow = np.where(
        backdrop,
        np.clip((SHADOW_HI - ratio.mean(2)) / (SHADOW_HI - SHADOW_LO), 0, 1) * SHADOW_STRENGTH,
        0.0)
    obj = np.where(backdrop, 0.0, np.clip((dist - OBJ_LO) / (OBJ_HI - OBJ_LO), 0, 1))

    oa = obj[..., None]
    fg = np.clip(np.where(oa > 0.03, (f - (1 - oa) * p) / np.maximum(oa, 0.03), f), 0, 255)

    sh = shadow * (1 - obj)
    alpha = obj + sh
    rgb = np.where(alpha[..., None] > 1e-3,
                   (fg * oa + SHADOW_RGB * sh[..., None]) / np.maximum(alpha, 1e-3)[..., None],
                   0.0)

    alpha = np.where(alpha < ALPHA_FLOOR, 0.0, alpha)
    # drop isolated speckle left by the fit's residual
    alpha = np.where(boxmean(alpha > 0.25, 4) >= 0.30, alpha, 0.0)
    return np.clip(rgb, 0, 255).astype(np.uint8), alpha.astype(np.float32)


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


def avif(rgba, sw, sh, w, h, q, dst, webp=False):
    """ffmpeg's AVIF muxer drops the alpha plane, so hand the frame to avifenc

    `webp` is only for the stills. The sequence itself is fetched as AVIF and
    nothing else: a browser without AVIF cannot decode the sequence at all and
    falls back to the stills, so a WebP copy of every frame is a megabyte of
    payload nothing ever requests.
    """
    png = dst + ".png"
    run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{sw}x{sh}", "-i", "pipe:0",
         "-vf", f"scale={w}:{h}:flags=lanczos", "-update", "1", png], input=rgba)
    run(["avifenc", "-y", "420", "-q", str(q), "--qalpha", str(q), "-s", "6",
         "-j", "all", png, dst], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if webp:
        run(["ffmpeg", "-v", "error", "-y", "-i", png, "-c:v", "libwebp",
             "-quality", "78", "-compression_level", "6", "-update", "1",
             dst.replace(".avif", ".webp")])
    os.remove(png)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")
    if not shutil.which("avifenc"):
        sys.exit("avifenc not found — install libavif")

    zf = zipfile.ZipFile(SRC)
    print(f"source {SRC_W}x{SRC_H}, {N_SRC} frames")

    print("reconstructing the backdrop…")
    frames = [load(zf, i) for i in range(1, N_SRC + 1)]
    plate = build_plate(frames)

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
