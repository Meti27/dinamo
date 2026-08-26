#!/usr/bin/env python3
"""
Turn the master burger clip into the scroll-story frame sequence.

    python3 scripts/build-burger-sequence.py

Reads  assets/source/burger-master.mp4  (not served; kept only for rebuilds)
Writes public/burger-seq/{desktop,mobile}/f###.avif
       public/burger-seq/manifest.json
       public/burger-still.{avif,webp}
       app/burgerFrames.ts

The clip renders the burger over a fixed blue backdrop. Because that backdrop
never moves, the burger can be cut out by difference matting -- reconstruct the
clean backdrop, then treat every pixel that differs from it as burger. That
keeps the exact artwork rather than regenerating it, and yields a real alpha
channel so the burger can sit on the page's own gradient.

Requires ffmpeg, avifenc (libavif) and numpy.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/source/burger-master.mp4")
SEQ = os.path.join(ROOT, "public/burger-seq")

# --- output shape -----------------------------------------------------------
DESKTOP_W, DESKTOP_Q = 480, 48
MOBILE_W, MOBILE_Q = 340, 44
N_EXPLODE, N_REASSEMBLE = 30, 26
N_EXPLODE_MOBILE, N_REASSEMBLE_MOBILE = 19, 16

# --- matte tuning -----------------------------------------------------------
OBJ_LO, OBJ_HI = 16.0, 46.0   # object knee, as RGB distance from the backdrop
BG_HUE_TOL = 0.105            # per-channel ratio spread that still reads as backdrop
SHADOW_HI, SHADOW_LO = 0.985, 0.55
SHADOW_STRENGTH = 0.70
SHADOW_RGB = np.array([13.0, 10.0, 9.0], np.float32)
ALPHA_FLOOR = 0.045
EPS = 3.0


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe_size(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,nb_frames", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h, n = out.split(",")[:3]
    return int(w), int(h), int(n)


def raw_frames(path, select, w, h, tmp):
    """decode the frames matching an ffmpeg select expression into a memmap"""
    dst = os.path.join(tmp, "frames.rgb")
    run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='{select}'",
         "-vsync", "0", "-pix_fmt", "rgb24", "-f", "rawvideo", dst])
    n = os.path.getsize(dst) // (w * h * 3)
    return np.memmap(dst, dtype=np.uint8, mode="r").reshape(n, h, w, 3)


def build_plate(frames, w, h):
    """
    Reconstruct the backdrop.

    Per-pixel median recovers it wherever the burger clears the pixel at some
    point. It never clears the middle of the frame, so fit a radial model to the
    pixels the median did recover and use that to fill the rest -- the backdrop
    is a radial gradient, so the model is near-exact (~1/255 mean residual).
    """
    n = len(frames)
    med = np.zeros((h, w, 3), np.uint8)
    agree = np.zeros((h, w), np.uint16)
    for y in range(0, h, 60):
        blk = frames[:, y:y + 60].astype(np.int16)
        m = np.median(blk, axis=0)
        med[y:y + 60] = m.astype(np.uint8)
        agree[y:y + 60] = (np.abs(blk - m).max(axis=3) <= 6).sum(axis=0)
        del blk
    valid = agree >= int(n * 0.80)

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    blue = med[..., 2].astype(np.float64)
    a = np.stack([xx[valid], yy[valid], xx[valid] ** 2, yy[valid] ** 2,
                  xx[valid] * yy[valid], np.ones(valid.sum())], 1)
    c1, c2, c3, c4, c5, _ = np.linalg.lstsq(a, blue[valid], rcond=None)[0]
    cx, cy = np.linalg.solve(np.array([[2 * c3, c5], [c5, 2 * c4]]), np.array([-c1, -c2]))

    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ri = r.astype(np.int32)
    rmax = int(r.max()) + 2
    prof = np.zeros((rmax, 3))
    cnt = np.zeros(rmax)
    for ch in range(3):
        np.add.at(prof[:, ch], ri[valid], med[..., ch][valid].astype(np.float64))
    np.add.at(cnt, ri[valid], 1.0)
    idx = np.nonzero(cnt > 0)[0]
    prof[idx] /= cnt[idx, None]
    k = np.ones(31) / 31
    for ch in range(3):
        prof[:, ch] = np.interp(np.arange(rmax), idx, prof[idx, ch])
        prof[:, ch] = np.convolve(np.pad(prof[:, ch], 15, mode="edge"), k, "valid")

    model = prof[ri]
    resid = np.abs(model - med.astype(np.float64)).max(2)
    print(f"  backdrop: centre ({cx:.0f},{cy:.0f}), "
          f"model residual mean {resid[valid].mean():.2f}/255")
    # trust the median only where it agrees with the smooth model
    keep = valid & (resid < 8)
    return np.where(keep[..., None], med.astype(np.float32), model).astype(np.float32)


def boxmean(mask, r):
    p = np.pad(mask.astype(np.float32), r + 1)
    ii = p.cumsum(0).cumsum(1)
    h, w = mask.shape
    k = 2 * r + 1
    return (ii[k:k + h, k:k + w] + ii[:h, :w] - ii[k:k + h, :w] - ii[:h, k:k + w]) / (k * k)


def key(frame, plate):
    """difference matte -> (rgb, alpha)"""
    f = frame.astype(np.float32)
    d = f - plate
    dist = np.sqrt((d * d).sum(2))
    ratio = (f + EPS) / (plate + EPS)

    # A near-constant per-channel ratio means the backdrop itself changed
    # brightness -- a contact shadow, or the bloom the burger casts on it.
    # Neither is the burger; only the shadow earns any alpha.
    backdrop = ratio.std(2) < BG_HUE_TOL
    rmean = ratio.mean(2)
    shadow = np.where(backdrop,
                      np.clip((SHADOW_HI - rmean) / (SHADOW_HI - SHADOW_LO), 0, 1) * SHADOW_STRENGTH,
                      0.0)
    obj = np.where(backdrop, 0.0, np.clip((dist - OBJ_LO) / (OBJ_HI - OBJ_LO), 0, 1))

    oa = obj[..., None]
    fg = np.clip(np.where(oa > 0.03, (f - (1 - oa) * plate) / np.maximum(oa, 0.03), f), 0, 255)

    sh = shadow * (1 - obj)
    alpha = obj + sh
    rgb = np.where(alpha[..., None] > 1e-3,
                   (fg * oa + SHADOW_RGB * sh[..., None]) / np.maximum(alpha, 1e-3)[..., None],
                   0.0)

    alpha = np.where(alpha < ALPHA_FLOOR, 0.0, alpha)
    alpha = np.where(boxmean(alpha > 0.25, 4) >= 0.34, alpha, 0.0)   # drop codec speckle
    return np.clip(rgb, 0, 255).astype(np.uint8), alpha.astype(np.float32)


def vspan(alpha, thr=0.35):
    ys = np.nonzero((alpha > thr).any(1))[0]
    return int(ys.min()), int(ys.max())


def bands(alpha, thr=0.55, gap=8):
    on = (alpha > thr).sum(1) > 3
    out, start = [], None
    for y, v in enumerate(on):
        if v and start is None:
            start = y
        if not v and start is not None:
            if y - start >= gap:
                out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, len(on) - 1))
    return out


def find_motion(frames, plate, step):
    """locate the explode and reassemble runs, skipping the clip's static holds

    Measured on the total empty space *between* layers rather than the burger's
    overall height: the outer buns reach their final positions well before the
    middle layers finish parting, so height plateaus early and would fold most
    of the static hold back into the sampled range.
    """
    gaps = []
    for i in range(len(frames)):
        _, a = key(np.array(frames[i]), plate)
        t, b = vspan(a)
        filled = ((a > 0.5).sum(1) > 3)[t:b + 1].sum()
        gaps.append((b - t + 1) - filled)
    h = np.array(gaps, float)
    lo, hi = h.min(), h.max()
    near_lo, near_hi = h <= lo + 0.02 * (hi - lo), h >= hi - 0.02 * (hi - lo)
    peak = int(np.argmax(h))
    ex_start = int(np.nonzero(near_lo[:peak])[0].max())
    ex_end = int(np.nonzero(near_hi[:peak + 1])[0].min())
    re_start = int(np.nonzero(near_hi[peak:])[0].max() + peak)
    re_end = int(np.nonzero(near_lo[re_start:])[0].min() + re_start)

    # Nudge every boundary outward into the neighbouring static hold. The last
    # sliver of travel barely moves the metric, so an unpadded run can end with
    # the burger still visibly ajar; the padding frames are near-duplicates of
    # the hold and cost almost nothing.
    pad = 2
    n = len(frames) - 1
    clamp = lambda i: max(0, min(n, i)) * step
    return ((clamp(ex_start - pad), clamp(ex_end + pad)),
            (clamp(re_start - pad), clamp(re_end + pad)))


def avif(rgba, sw, sh, w, h, q, dst):
    """ffmpeg's AVIF muxer drops the alpha plane, so hand the frame to avifenc"""
    png = dst + ".png"
    run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{sw}x{sh}", "-i", "pipe:0",
         "-vf", f"scale={w}:{h}:flags=lanczos", "-update", "1", png], input=rgba)
    run(["avifenc", "-y", "420", "-q", str(q), "--qalpha", str(q), "-s", "6",
         "-j", "all", png, dst], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(png)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} — the master clip is required to rebuild the sequence")
    if not shutil.which("avifenc"):
        sys.exit("avifenc not found — install libavif")

    w, h, total = probe_size(SRC)
    print(f"source {w}x{h}, {total} frames")

    with tempfile.TemporaryDirectory(prefix="burger-plate-") as tmp:
        print("building the backdrop plate…")
        coarse = raw_frames(SRC, r"not(mod(n\,4))", w, h, tmp)
        plate = build_plate(coarse, w, h)
        (ex0, ex1), (re0, re1) = find_motion(coarse, plate, 4)
        print(f"  explode frames {ex0}..{ex1}, reassemble {re0}..{re1}")
        del coarse

    with tempfile.TemporaryDirectory(prefix="burger-move-") as tmp:
        sel = f"between(n\\,{ex0}\\,{ex1})+between(n\\,{re0}\\,{re1})"
        move = raw_frames(SRC, sel, w, h, tmp)
        n_ex_src = ex1 - ex0 + 1

        def pick(lo, hi, n):
            return [lo + round(i * (hi - lo) / (n - 1)) for i in range(n)]

        chosen = pick(0, n_ex_src - 1, N_EXPLODE) + pick(n_ex_src, len(move) - 1, N_REASSEMBLE)
        print(f"keying {len(chosen)} frames…")
        keyed = [key(np.array(move[i]), plate) for i in chosen]

    # crop to the union of every frame so the burger never shifts in its box
    x0, y0, x1, y1 = w, h, 0, 0
    for _, a in keyed:
        m = a > 0.06
        cx, cy = np.nonzero(m.any(0))[0], np.nonzero(m.any(1))[0]
        x0, x1 = min(x0, cx.min()), max(x1, cx.max())
        y0, y1 = min(y0, cy.min()), max(y1, cy.max())
    x0, y0 = int(max(0, x0 - 8)), int(max(0, y0 - 8))
    x1, y1 = int(min(w - 1, x1 + 8)), int(min(h - 1, y1 + 8))
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    print(f"crop {cw}x{ch} (aspect {cw / ch:.4f})")

    # --- layer geometry -----------------------------------------------------
    # The explosion is very nearly a uniform scale about the burger's centre, so
    # each layer keeps a fixed share of the overall span. Measure those shares on
    # the fully-exploded frame, then read them back against each frame's span.
    ex_alpha = keyed[N_EXPLODE - 1][1]
    six = bands(ex_alpha)
    if len(six) != 6:
        sys.exit(f"expected 6 separated layers at full explode, found {len(six)}")
    et, eb = vspan(ex_alpha)
    shares = [(((s + e) / 2) - et) / (eb - et) for s, e in six]

    # Where the assembled burger sits in the final frame, as fractions of the
    # crop. The closing beat is scaled and offset against this so its opening
    # frame lands exactly on the burger this sequence ends on.
    fa = keyed[-1][1]
    fm = fa > 0.12
    fc, fr = np.nonzero(fm.any(0))[0], np.nonzero(fm.any(1))[0]
    assembled = ((fc.min() - x0) / cw, (fr.min() - y0) / ch,
                 (fc.max() + 1 - x0) / cw, (fr.max() + 1 - y0) / ch)
    print(f"assembled anchor x {assembled[0]:.4f}..{assembled[2]:.4f} "
          f"y {assembled[1]:.4f}..{assembled[3]:.4f}")

    layers = []
    for _, a in keyed:
        t, b = vspan(a)
        row = []
        for i, share in enumerate(shares):
            centre = t + share * (b - t)
            band = (a > 0.5)[max(0, int(centre) - 4):int(centre) + 5]
            xs = np.nonzero(band.any(0))[0]
            lo, hi = (xs.min(), xs.max()) if len(xs) else (0, cw - 1)
            row.append([round((centre - y0) / ch, 4),
                        round(float(lo - x0) / cw, 4),
                        round(float(hi - x0) / cw, 4)])
        layers.append(row)

    # --- encode -------------------------------------------------------------
    def emit(name, width, q, idxs):
        d = os.path.join(SEQ, name)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        height = round(width * ch / cw / 2) * 2
        size = 0
        for n, i in enumerate(idxs):
            rgb, a = keyed[i]
            buf = np.dstack([rgb[y0:y1 + 1, x0:x1 + 1],
                             (a[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)]).tobytes()
            p = os.path.join(d, f"f{n:03d}.avif")
            avif(buf, cw, ch, width, height, q, p)
            size += os.path.getsize(p)
        print(f"  {name}: {len(idxs)} frames @ {width}x{height} -> {size / 1024:.0f} KB")
        return height

    os.makedirs(SEQ, exist_ok=True)
    desktop = list(range(len(keyed)))
    mobile = (pick(0, N_EXPLODE - 1, N_EXPLODE_MOBILE)
              + pick(N_EXPLODE, len(keyed) - 1, N_REASSEMBLE_MOBILE))
    dh = emit("desktop", DESKTOP_W, DESKTOP_Q, desktop)
    emit("mobile", MOBILE_W, MOBILE_Q, mobile)

    rgb, a = keyed[-1]
    buf = np.dstack([rgb[y0:y1 + 1, x0:x1 + 1],
                     (a[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)]).tobytes()
    avif(buf, cw, ch, DESKTOP_W, dh, 60, os.path.join(ROOT, "public/burger-still.avif"))
    run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{cw}x{ch}", "-i", "pipe:0", "-vf", f"scale={DESKTOP_W}:{dh}:flags=lanczos",
         "-c:v", "libwebp", "-quality", "76", "-compression_level", "6", "-update", "1",
         os.path.join(ROOT, "public/burger-still.webp")], input=buf)

    json.dump({"aspect": round(cw / ch, 5), "explodeFrames": N_EXPLODE,
               "desktop": {"count": len(desktop)},
               "mobile": {"count": len(mobile), "map": mobile},
               "layers": layers},
              open(os.path.join(SEQ, "manifest.json"), "w"), separators=(",", ":"))

    rows = "\n".join(
        "  [" + ", ".join("[" + ", ".join(f"{v}" for v in cell) + "]" for cell in row) + "],"
        for row in layers)
    with open(os.path.join(ROOT, "app/burgerFrames.ts"), "w") as fh:
        fh.write(f"""// GENERATED by scripts/build-burger-sequence.py — do not edit by hand.
// Geometry of the scroll-story burger sequence in public/burger-seq/.

/** width / height of every frame in the sequence */
export const ASPECT = {round(cw / ch, 5)};

/** frames 0..EXPLODE_FRAMES-1 take the burger apart; the rest put it back together */
export const EXPLODE_FRAMES = {N_EXPLODE};

export const DESKTOP_COUNT = {len(desktop)};
export const MOBILE_COUNT = {len(mobile)};

/** mobile frame i is a copy of desktop frame MOBILE_MAP[i] */
export const MOBILE_MAP = {json.dumps(mobile)};

/**
 * Where the assembled burger sits inside the last frame, as fractions of the
 * frame box. Paired with the closing beat's own anchor to line the two up.
 */
export const ASSEMBLED_ANCHOR = {{
  left: {assembled[0]:.4f},
  top: {assembled[1]:.4f},
  right: {assembled[2]:.4f},
  bottom: {assembled[3]:.4f},
}};

/**
 * Per frame, per ingredient layer: [centreY, leftX, rightX] as fractions of the
 * frame box. Measured from the alpha channel at export time, which is what lets
 * each label sit level with its layer and run its rule up to the layer's edge.
 */
export const LAYER_GEOMETRY: readonly (readonly (readonly number[])[])[] = [
{rows}
];
""")
    print("wrote app/burgerFrames.ts")


if __name__ == "__main__":
    main()
