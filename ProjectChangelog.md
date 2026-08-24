### [2026-08-24] Rebuilt the scroll-story burger animation

**Changes:** The hero burger was a 27 MB MP4 scrubbed with `video.currentTime` on
every scroll tick. That forces the decoder back to a keyframe on each tick (the
jank), does not scrub at all on iOS Safari, and the clip was baked onto its own
blue backdrop — so a hard-edged square sat over the hero in every frame. Replaced
it with a preloaded AVIF frame sequence blitted to a `<canvas>`.

- Cut the burger out of the master clip by **difference matting**. The clip's
  backdrop is perfectly static (measured std ≈ 0), so it can be reconstructed —
  per-pixel median where the burger clears the pixel, a fitted radial model for
  the middle it never clears (~1.2/255 mean residual) — and subtracted. This
  keeps the exact approved artwork instead of regenerating it, and costs nothing.
- Separated contact shadows and the burger's bloom on the backdrop from the
  burger itself: a near-constant per-channel ratio to the plate means the
  backdrop changed brightness, not that there is an object there. Shadows are
  kept and recoloured neutral so they read on any background; the bloom is
  dropped. Without this the layers carried blue halos.
- Dropped the clip's static holds (only ~250 of 480 frames actually move) and
  re-sampled to 34 desktop / 24 mobile frames. Payload 27 MB → 1.5 MB / 0.5 MB.
- Ingredient labels now track measured layer geometry, so each label sits level
  with the layer it names and its rule runs to that layer's own edge. They used
  fixed percentages of a container the burger was letterboxed inside, so the
  connectors pointed at empty background.
- The menu wipe now sweeps over the burger and runs continuously into the ticker
  instead of hard-cutting. Story shortened 560vh → 380vh.
- Fixed: `.story-intro h1` at `line-height:.77` made Arial's caron on Č collide
  with the line above, so the headline read "CEKA" on a Bosnian-language site.

**Files:** `app/BurgerSequence.tsx`, `app/burgerStory.ts`, `app/burgerFrames.ts`
(generated), `scripts/build-burger-sequence.py`, `app/page.tsx`,
`app/globals.css`, `app/layout.tsx`, `README.md`, `public/burger-seq/`,
`public/burger-still.*`, `public/menu/`, `public/og.jpg`,
`assets/source/burger-master.mp4`

**Decisions:**
- AVIF over WebP for the frames. ffmpeg's libwebp wrapper stores alpha
  losslessly and exposes no `alpha_quality`, which dominated the file size
  (~100 KB/frame vs ~44 KB). ffmpeg's AVIF *muxer* silently drops the alpha
  plane, so encoding goes through `avifenc`. Browsers without AVIF get
  `burger-still.*`, the same path reduced-motion visitors take.
- Kept the master clip in `assets/source/` (not served) so the sequence can be
  rebuilt; the build script auto-detects the moving ranges rather than hardcoding
  frame numbers.
- Menu photos were hotlinked from `media.dodostatic.com`. Same photos, now
  mirrored into `public/menu/` so a third-party CDN cannot break the menu.
- Deleted ~40% of `globals.css` — selectors (`.hero*`, `.burger-stage`,
  `.price-stamp`, `.duo`, `.feature*`, `.story-layer*`) with no matching JSX.

**TODOs:**
- `npm test` fails on `renders development preview metadata`; it asserts a
  `codex-preview` meta tag injected by the ChatGPT Sites host, which nothing in
  this repo emits. Verified failing identically on the pre-change tree.
- `npm run lint` reports one pre-existing error at `app/page.tsx:93` (setState in
  an effect for the localStorage language restore). Left alone — the obvious fix
  risks a hydration mismatch.
- The reduced-motion and no-AVIF fallbacks were verified by asset and markup
  inspection, not exercised end-to-end in a browser.
- At 360px wide the outer ingredient labels still graze the burger; legible via
  text-shadow, but a phone-specific label layout would be better.
