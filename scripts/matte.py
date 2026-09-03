"""
Shared difference-matting pipeline for the site's frame sequences.

Both scroll sequences (the burger, the ice cream) are shot the same way: a
subject over a studio backdrop that never moves. That means the backdrop can be
subtracted to cut the subject out with a real alpha channel and a contact
shadow, instead of shipping a full 1920x1080 rectangle per frame. This module
is that technique, factored out so `build-frames.py` and `build-icecream.py`
share one implementation instead of two copies that drift apart.

The one piece each caller keeps to itself is the SUBJECT box and the matte
tuning constants — those depend on how much of the frame the subject and its
shadow ever reach, which is a property of the footage, not of the technique.

Requires ffmpeg and avifenc (libavif).
"""

import os
import subprocess
import sys

import numpy as np


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def load(zf, i, w, h, digits=2):
    """decode one PNG straight from the archive, no extraction"""
    data = zf.read(f"{i:0{digits}d}.png")
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-pix_fmt", "rgb24",
         "-f", "rawvideo", "pipe:1"],
        input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(h, w, 3).astype(np.float64)


def build_plate(frames, w, h, subject):
    """
    Reconstruct the backdrop, including behind the subject.

    A per-pixel median across frames recovers the backdrop everywhere the
    subject clears a pixel at some point — but if the subject never leaves the
    middle of the frame (an explosion that never clears centre, or a turntable
    spinning in place), the median has nothing to recover it from. The backdrop
    is a smooth gradient with a vignette though, so a low-order surface fitted
    to the pixels *outside* `subject` predicts the rest just as accurately as it
    reproduces the pixels it was fitted on — verified below.
    """
    med = np.median(np.stack(frames), 0)
    t, b, l, r = subject
    known = np.ones((h, w), bool)
    known[t:b, l:r] = False

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    ny, nx = yy / h, xx / w
    basis = np.stack([np.ones_like(nx), nx, ny, nx * nx, ny * ny, nx * ny,
                      nx * nx * ny, nx * ny * ny, ny ** 3, nx ** 3], -1)

    plate = np.zeros((h, w, 3))
    for c in range(3):
        coef, *_ = np.linalg.lstsq(basis[known], med[..., c][known], rcond=None)
        plate[..., c] = basis @ coef

    resid = np.abs(plate - med)[known]
    # a strip inside the box that is still background, so it tests extrapolation
    probe = np.zeros((h, w), bool)
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


def key(frame, plate, *, obj_lo=16.0, obj_hi=44.0, bg_hue_tol=0.10,
        shadow_hi=0.985, shadow_lo=0.55, shadow_strength=0.70,
        shadow_rgb=(13.0, 10.0, 9.0), alpha_floor=0.10):
    """difference matte -> (rgb, alpha), keeping the contact shadow"""
    f = frame.astype(np.float32)
    p = plate.astype(np.float32)
    dist = np.sqrt(((f - p) ** 2).sum(2))
    ratio = (f + 3.0) / (p + 3.0)

    # A near-constant per-channel ratio means the backdrop itself got darker --
    # the shadow the subject casts on it. That is not the subject, but it is not
    # nothing either, so it earns partial alpha and its own near-black colour.
    backdrop = ratio.std(2) < bg_hue_tol
    shadow = np.where(
        backdrop,
        np.clip((shadow_hi - ratio.mean(2)) / (shadow_hi - shadow_lo), 0, 1) * shadow_strength,
        0.0)
    obj = np.where(backdrop, 0.0, np.clip((dist - obj_lo) / (obj_hi - obj_lo), 0, 1))

    oa = obj[..., None]
    fg = np.clip(np.where(oa > 0.03, (f - (1 - oa) * p) / np.maximum(oa, 0.03), f), 0, 255)

    sh = shadow * (1 - obj)
    alpha = obj + sh
    rgb = np.where(alpha[..., None] > 1e-3,
                   (fg * oa + np.array(shadow_rgb, np.float32) * sh[..., None])
                   / np.maximum(alpha, 1e-3)[..., None],
                   0.0)

    alpha = np.where(alpha < alpha_floor, 0.0, alpha)
    # drop isolated speckle left by the fit's residual
    alpha = np.where(boxmean(alpha > 0.25, 4) >= 0.30, alpha, 0.0)
    return np.clip(rgb, 0, 255).astype(np.uint8), alpha.astype(np.float32)


def avif(rgba, sw, sh, w, h, q, dst, webp=False):
    """ffmpeg's AVIF muxer drops the alpha plane, so hand the frame to avifenc

    `webp` is only for stills. A sequence is fetched as AVIF and nothing else: a
    browser without AVIF cannot decode the sequence at all and falls back to the
    stills, so a WebP copy of every frame is payload nothing ever requests.
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
