### [2026-08-25] Added the boxing finale, and set the site in a real typeface

**Changes:** The scroll story now ends with the reassembled burger settling into
a navy-and-gold Dinamo box that closes over it, crest on the lid. Generated with
Higgsfield; integrated as a second canvas sequence so it stays smooth on a phone.

- Generated the packaging with `nano_banana_pro` (three concepts, picked the
  clamshell) and the motion with `kling3_0` using **both** a start and an end
  keyframe — start = the burger this site already ships, composited onto the box
  render's own backdrop; end = the closed box. Constraining both ends is what
  kept the shot on-model instead of letting it invent a burger.
- The **crest is composited, not generated**: the model renders a blank gold
  medallion and the real crest is warped into that ellipse with the lid's own
  shading applied. A generated logo would have been subtly wrong.
- Cut a clean transparent crest out of `public/dinamo.jpg` (it was a photo of the
  badge on fabric) by fitting the disc — 0.85px edge residual.
- The closing frames are **not** cut out. The box is navy on a navy backdrop and
  will not difference-matte; instead the page fades its background to the clip's
  studio colour and the frames are drawn opaque. Opaque also costs ~5 KB/frame
  against ~44 KB with alpha, so the whole beat is 478 KB.
- Both sequences report where the assembled burger sits inside their own frame;
  the closing beat is scaled and offset from those two anchors so its first frame
  lands on the burger the previous beat ended on. Measured handoff error is ~4px
  on a 528px burger. It then settles to a centred, viewport-fitted hero framing,
  because the box is far wider than the burger.
- Replaced Arial with **Archivo**, self-hosted (66 KB, latin + latin-ext for
  Č/Ć/Ž/Š/Đ). Rebalanced display sizes — the wider face was running the headline
  into the burger and wrapping it onto the burger on phones.

**Files:** `app/FrameSequence.tsx` (generalised from `BurgerSequence.tsx`, now
deleted), `app/finaleFrames.ts` (generated), `app/burgerStory.ts`, `app/page.tsx`,
`app/globals.css`, `scripts/build-finale-sequence.py`,
`scripts/build-burger-sequence.py`, `public/finale-seq/`, `public/finale-still.*`,
`public/fonts/`, `assets/source/burger-boxing.mp4`, `README.md`

**Decisions:**
- `kling3_0` at 8.75 credits/shot over `seedance_2_5` at 45 — five times the
  attempts for the same spend. Whole finale cost ~14.75 credits (95.25 left).
- Kept the canvas-sequence architecture rather than embedding the generated clip
  as a video. The clip is the *source*; the site never ships an MP4, which is
  what keeps scrubbing smooth on iOS.
- Asset preloading is a plain `startDelayMs`, not a scroll trigger. Scroll state
  is driven by requestAnimationFrame, which a background tab throttles — a
  sequence that never preloads is worse than one that preloads early.

**TODOs:**
- `npm test` still fails on `renders development preview metadata` (host-injected
  `codex-preview` meta; fails identically on the pre-change tree).
- `npm run lint`: one pre-existing error at `app/page.tsx:102` (setState in an
  effect for the localStorage language restore).
- Reduced-motion and no-AVIF fallbacks verified by asset and markup inspection,
  not exercised end-to-end.
- The closing element deliberately overflows the viewport between p≈0.72 and
  0.80 while the box rises from off-frame; content there is the tray entering, so
  nothing meaningful is clipped.

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
