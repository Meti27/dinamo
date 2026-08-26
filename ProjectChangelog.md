### [2026-08-25] Cross-faded frames, no React in the animation loop

**Changes:** Two complaints — skipping frames on desktop, lag on phone. Neither
was generation-limited, so no Higgsfield credits were spent on them.

- **The skipping is gone, at zero payload cost.** The sequence is a few dozen
  stills spread over several screens of scrolling, so snapping to the nearest
  one held each for many display frames and the motion stepped. `FrameSequence`
  now cross-dissolves the two frames a fractional position falls between.
  It has to be a *linear* dissolve, not just painting the second over the first:
  these frames carry alpha, so source-over leaves the outgoing burger fully
  opaque underneath and you see two burgers. Drawing A at `1-t` then adding B at
  `t` with `globalCompositeOperation = "lighter"` gives `A*(1-t) + B*t`, alpha
  included. Verified: where a pixel has burger in A and not in B, naive
  source-over leaves it at 253/255 while the dissolve correctly halves it to
  128/255. Cost is two blits — measured 0.003ms per paint.
- **React is out of the animation loop.** `stop` was state, so every frame
  reconciled twenty-odd elements; on a mid-range phone that is the whole frame
  budget. The loop now writes styles to refs directly and drives both sequences
  through an imperative `setFrame` handle. React only builds the structure and
  swaps copy on a language change. Labels skip their geometry entirely while
  invisible, which is most of the story.
- **Fixed a mobile-only stutter.** Progress was `-rect.top / (offsetHeight -
  window.innerHeight)`, mixing an `svh`-sized section with `innerHeight`, which
  *grows as a phone's URL bar collapses*. The denominator moved mid-scroll, so
  progress jumped. It now measures the sticky stage, which is `svh` and stable.
- Frames raised: burger 42 -> 56 desktop, 29 -> 35 mobile; finale 38 -> 52 and
  26 -> 32. Cross-fading works better the smaller the gap between neighbours.
- Promoted the three continuously-fading decorative layers with
  `will-change: opacity` so their blur and mask rasterise once instead of every
  frame, and dropped `.story-grid:after` on phones — two 25vh spread shadows is
  a lot of paint for decoration.

**Browser compatibility:** added `vh` fallbacks ahead of every `svh` (Safari
<15.4 and Chrome <108 drop the whole declaration, which would leave the sticky
stage with no height) and a `-webkit-mask-image` prefix for older WebKit. The
runtime surface is `createImageBitmap` (with an `Image` fallback),
`ResizeObserver`, `matchMedia` and `globalCompositeOperation` — all long-standing.
AVIF failure still falls back to the still image.

**Files:** `app/FrameSequence.tsx`, `app/ScrollStory.tsx`, `app/globals.css`,
both `scripts/build-*-sequence.py`, generated `app/burgerFrames.ts`,
`app/finaleFrames.ts`, `public/burger-seq/`, `public/finale-seq/`

**Payload:** desktop sequences 3214 KB, mobile 922 KB, `public/` 4.97 MB.

**TODOs:**
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:91`.
- At 360px wide the outer ingredient labels still graze the burger — a genuine
  space constraint at that width, not a regression.
- The burger still re-renders across the handoff into the box. That one *is*
  generation-side and is what credits could buy; not attempted here because the
  reported problems were not.

### [2026-08-25] Reverted the snapped stops; continuous scroll with a speed limit

**Changes:** The snapped-stop version read worse than what it replaced — the
instant jumps made the scrollbar teleport and the phase counter tick, which feels
broken even when the frames between are smoother. Reverted the snapping and went
back to the animation following the scroll continuously, with a cap on how fast
it can advance.

- Removed CSS scroll-snap, the per-stop markers, and the wheel/touch/key handler
  that took one gesture per stop. Scrolling is entirely native again.
- The follower is exponential in *elapsed time* (`1 - exp(-rate * dt)`), so it is
  frame-rate independent — the earlier per-frame-fraction version ran twice as
  fast on a 120Hz display — and the per-frame movement is then clamped to
  `MAX_STOPS_PER_SEC`. That is the "limit how hard you can scroll": a violent
  flick no longer blasts through the story, it just keeps playing until it
  catches up. Measured: slamming the scrollbar across the whole story takes
  ~2.1s instead of arriving instantly; a small nudge is 90% resolved in ~0.20s,
  so ordinary scrolling still feels attached rather than floaty.
- `FOLLOW_RATE` (12) and `MAX_STOPS_PER_SEC` (2.4) at the top of
  `app/ScrollStory.tsx` are the two tuning knobs. Brisk deliberate scrolling is
  about 2 beats/sec, under the cap, so it is not clamped in normal use.

The per-frame fixes from the previous commit are all kept, since none of them
were about snapping: the story owning its own state instead of re-rendering the
whole page, no drop-shadow filter over a canvas that repaints every frame, no
opacity transition fighting per-frame inline opacity, and the denser reassembly.

**Files:** `app/ScrollStory.tsx`, `app/globals.css`

**TODOs:**
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:91`.
- This repo has no deploy hook (no `.github/`, no `vercel.json`,
  `.openai/hosting.json` has a null project id), so pushing does not update the
  ChatGPT Sites deployment.

### [2026-08-25] Fixed what was actually making the scroll story glitch

**Changes:** The previous commit snapped the story to five stops so the animation
would play rather than be dragged, but it did not actually achieve that, and four
independent per-frame costs were left in place.

- **The stop jump was still animated.** `go()` scrolled with `behavior: "smooth"`
  while `read()` was bound to `scroll`, so the target moved on every scroll event
  *during the browser's own scroll animation* — the tween chased a moving target
  and every hitch in that scroll (which also fights scroll-snap) landed in the
  burger. The stage is `position: sticky`, so scrolling inside the story moves
  nothing on screen; the jump is now instant and the tween is the sole animator.
  Note `behavior: "auto"` is **not** instant — it defers to the element's
  `scroll-behavior`, which is `smooth` here for the nav anchors. It has to be
  `behavior: "instant"`, which is what actually fixed it.
- **The easing was frame-rate dependent.** `stopRef += gap * 0.16` per frame
  converges twice as fast on a 120Hz display as on 60Hz, and lurches then crawls.
  Replaced with a 650ms `performance.now()` tween on easeInOutCubic that lands
  exactly on target and retargets from wherever it is mid-flight.
- **A blur was being re-derived every frame.** `.burger-media` carried
  `drop-shadow(0 24px 24px …)` over a canvas that repaints every frame, so the
  browser re-blurred its alpha each time. Removed; the frames already carry the
  source's own contact shadows, and a static `.story-ground` ellipse supplies the
  grounding for free.
- **The whole page re-rendered 60x a second.** `stop` lived in `Home`, so every
  tween frame reconciled the nav, the 14-card menu grid, the location block and
  the footer. The story is now `app/ScrollStory.tsx` and owns that state; the rest
  of the page are siblings that no longer re-render while it animates.
- **The labels fought their own animation.** `.ingredient-label` had
  `transition: opacity .12s` while opacity is written inline every frame, so the
  browser was always interpolating toward a value that had already moved —
  visible as smearing. Removed, along with six permanent `will-change` layers.
- Reassembly re-exported denser, 12 -> 20 desktop and 9 -> 14 mobile: at 650ms a
  transition is ~39 display frames, so 12 source frames were held ~3.3 frames
  each, which was the visible stepping. `public/` 3.58 -> 4.02 MB.

**Files:** `app/ScrollStory.tsx` (new), `app/page.tsx`, `app/globals.css`,
`scripts/build-burger-sequence.py`, `app/burgerFrames.ts` (generated),
`public/burger-seq/`

**Decisions:**
- Kept CSS scroll-snap under the gesture handler as a fallback for scrollbar
  drags; with instant jumps landing exactly on snap points it never re-adjusts.
- `ASSEMBLED_ANCHOR` is unchanged by the re-export, so the closing beat's
  alignment with the burger still holds without retuning.

**Verified:** one gesture moves exactly one stop; a burst of three wheel events
still moves one; up at stop 1 and down at stop 5 pass through to the page rather
than trapping. Stops rest clean.

**TODOs:**
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:91` (setState in an effect for the localStorage
  language restore).
- The burger still re-renders at the handoff into the box — generation-side, and
  unrelated to smoothness.

### [2026-08-25] Scroll story moved from continuous scrubbing to fixed stops

**Changes:** The story was scrubbed straight from scroll position, so every
frame was tied to however jerkily the wheel was turned — which is what made it
feel laggy — and it re-rendered on every scroll event. It now runs as five
stops, and the scroll only chooses a destination.

- `app/burgerStory.ts` is rebuilt around a `stop` value (0..4: whole, apart,
  whole again, boxed, menu wipe) instead of a raw 0..1 scroll fraction. Every
  stop lands on a clean resting state — verified by evaluating the timing
  functions directly: at stop 1 all six labels read 1.0 and the burger is fully
  apart; at stop 2 it is whole with the studio backdrop fully faded; at stop 3
  the box is shut; at stop 4 the wipe is full.
- Scroll sets a target; a separate eased loop walks the animation to it. So
  playback is smooth regardless of how coarse or fast the gesture was, and
  re-renders happen in short bursts during a transition rather than continuously.
- Section is 500svh with one snap marker per stop
  (`scroll-snap-align:start; scroll-snap-stop:always`), `scroll-snap-type` set to
  `y proximity` on the root so the rest of the page still scrolls freely.
- Snapping alone goes to the *nearest* point, so one wheel notch would have
  fallen back to where it started. A wheel/touch/key handler moves exactly one
  stop per gesture, with a 640ms debounce so a flick's momentum does not skip
  several. It binds only while the story fills the viewport and hands the
  gesture back at either end — verified there is no scroll trap: up at stop 0
  and down at stop 4 both pass through to the page.

**Files:** `app/burgerStory.ts`, `app/page.tsx`, `app/globals.css`

**Decisions:**
- Kept native scrolling and CSS snap underneath the gesture handler rather than
  fully hijacking: the scrollbar stays honest, dragging it still works, and
  keyboard/touch are handled explicitly.
- Reduced motion gets `behavior: "auto"` on the stop-to-stop jump.

**TODOs:**
- Stop-to-stop easing and snapping could not be verified visually here: both are
  driven by requestAnimationFrame, which a background tab starves, so every
  screenshot caught the tween mid-flight. The timing maths and the gesture
  routing were verified numerically instead.
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:107`.

### [2026-08-25] Fixed the closing-beat flicker; reshot it on a model that holds detail

**Changes:** Two problems with the closing beat, one a bug and one a model choice.

- **The flicker was a canvas bug, not a frame-count problem.** `FrameSequence`
  sized the canvas backing store from the *element*, and the closing beat
  animates that element's size on every scroll tick. Assigning `canvas.width`
  blanks the canvas, and the repaint landed a frame later — so every tick of the
  settle cleared and repainted. The backing store now comes from the frame
  itself and stays constant (verified: 720x720 across the whole settle); CSS
  scales the element. Also stopped cross-fading the two canvases — they are
  built to coincide at the handoff, so blending them only doubled the burger.
- **Reshot the beat on `minimax_h3` at 2K** (20 credits) after comparing frames
  against the source: Kling was smoothing the food away — sesame seeds gone off
  the bun, char gone off the patty — by ~frame 10. minimax holds both. Since the
  layer beat is crisp, drifting into a crisp burger reads far better than
  drifting into a soft one. Bumped 28 -> 38 desktop frames (20 -> 26 mobile)
  while there; opaque frames are cheap, so the beat is 746 KB.

**Files:** `app/FrameSequence.tsx`, `app/globals.css`,
`scripts/build-finale-sequence.py`, `app/finaleFrames.ts` (generated),
`public/finale-seq/`, `assets/source/burger-boxing.mp4`

**Decisions:**
- `minimax_h3` will not accept `image_references` alongside `start_image`/
  `end_image`, and the keyframes are what make the handoff work, so identity is
  pinned by the start frame alone. Its 2K output is what preserves the detail.
- Kept the layer beat on the original clip. Regenerating it would make the whole
  story consistent, which is the ask, but the evidence says the generated burger
  differs from the one the site ships today — so that is the user's call, not a
  silent substitution.

**TODOs:**
- The burger still visibly re-renders across the handoff: minimax redraws it in
  its own hand (seeds larger, proportions slightly different). Closing that gap
  properly means regenerating the layer beat from the same model, ~42 credits.
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:102`.

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
