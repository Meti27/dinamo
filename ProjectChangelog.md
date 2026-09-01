### [2026-09-01] Fixes: scroll-back, the invisible menu, the elliptical logo

**Changes:** Four real bugs, three of which I shipped without catching. Every one
is now covered by a headless-Chrome check rather than a screenshot at one scroll
position, which is how they got through.

- **The headline never came back when you scrolled up.** It had a one-shot
  entrance tween animating `opacity` and `y`, and a separate scroll-driven tween
  animating the same two properties. Reversing the scrub restored the values GSAP
  had recorded for the *entrance*, so the headline returned at opacity 0 and
  stayed there. Now there is one timeline on the pinning trigger and every tween
  is a `fromTo` declaring both ends, so there is nothing to record and it
  reverses exactly; the entrance moved onto a child element so nothing else
  touches what the scrub owns. Verified: opacity 1 -> 0 -> 1 -> 1 over two full
  round trips, on desktop and mobile.

- **The whole menu rendered blank after clicking "Meni" in the nav.** The cards
  used a CSS scroll-driven reveal (`animation-timeline: view()` with
  `animation-fill-mode: both`), which holds an element at its `from` state —
  opacity 0 — until the browser decides it has entered the viewport. Jump to the
  section instead of scrolling to it and the timeline never advances: all
  fourteen cards stayed invisible. Removed. Core content does not get to depend
  on that.

- **The logo rendered as an ellipse.** `public/dinamo.jpg` is 840x630 with a
  mottled blue backdrop, and the CSS put `border-radius: 50%` on it — a
  non-square image under a 50% radius is an ellipse, not a circle. Added
  `scripts/build-logo.py`, which finds the crest by its gold rim, fits a circle,
  and writes a square `public/dinamo-logo.{avif,webp}` with transparency outside
  it. Used in the nav, the location panel and the footer through one `Logo`
  component.

- **The location panel looked unfinished.** Its decorative `.rings` were
  `radial-gradient(circle, …)` on an `inset: 0` element, which on a wide panel is
  a stretched ellipse clipped by the edges. Replaced with a centred square glow
  behind the crest, the two columns now share a height with their content
  centred, and the footer continues the panel's colour with a hairline rule
  instead of introducing a fourth blue.

**Also:** the menu is two columns on phones rather than one — fourteen
full-width square cards was about six thousand pixels of menu — with the card
name and price stacked at that size. `.menu` and `.location` get
`scroll-margin-top` so an anchor jump does not land the heading under the fixed
nav.

**Verified** (headless Chrome over CDP, at 1440x900, 390x844 and with
`prefers-reduced-motion`): headline returns to full opacity after two round
trips; 14/14 cards visible after a nav click; no console errors at any size; all
14 menu images and the logo load; anchors land correctly; reduced motion still
renders two stills with no pin. Scrub cost unchanged at 28 layouts across a
91-step scrub.

**Files:** `src/components/BurgerStory.tsx`, `src/components/Logo.tsx` (new),
`src/components/Nav.tsx`, `src/components/Location.tsx`,
`src/components/Footer.tsx`, `src/styles.css`, `scripts/build-logo.py` (new),
`public/dinamo-logo.{avif,webp}` (new)

**TODOs:**
- `public/dinamo.jpg` is still the source for `build-logo.py` and is no longer
  referenced by the page. Keep it, or replace it with a proper vector crest and
  drop the extraction step.

### [2026-09-01] Rebuilt from scratch: Vite + React + GSAP, new footage

**Changes:** The old repo was ChatGPT Sites scaffolding — two build systems (dev
was Vite + vinext + Cloudflare, build was `next build --webpack`), an unused
Drizzle/D1 layer, a `worker/`, a 3,347-file `.sites-runtime/`, none of which the
page touched. Deleted it and rebuilt in place on Vite + React + TypeScript with
GSAP/ScrollTrigger. Git history keeps the old project; `73931e3` is the last
commit of it.

**New footage** (`assets/source/burger-frames.zip`, 30 PNGs, 1920x1080). What it
actually is, measured before planning around it:

- It runs **closed -> apart only**. There is no reassembly in the source, so the
  scrub plays 1->30->1. That is where "the burger goes back assembled" comes
  from, at no extra asset cost.
- The PNG alpha is fully opaque — the navy backdrop is baked in. But it never
  moves (2/255 mean drift across all 30), so it mattes out.
- The burger uses 16% of the frame area, so cropping is worth ~30x in pixels.

**The matte was proven before anything was built on it.** The burger never
clears the middle of the frame, so a median across frames recovers the backdrop
everywhere except where it is needed. A cubic surface fitted per channel to the
pixels outside the subject box reproduces known background at **1.70/255** and
the strip it has to extrapolate at **1.68/255** — extrapolating across the
burger is as accurate as interpolating. On magenta there is no fringing and the
contact shadow survives. Crop came out 553x722, 19.3% of the source.

**Layer detection had to change.** These layers never fully separate — even at
full spread the outline stays continuous, so looking for empty rows between them
finds two bands (the burger, and its shadow). What is always there is a
*narrowing*: the row-width profile dips sharply between one ingredient and the
next. `necks()` takes the deepest dips by how far each falls below the widest
point either side, and the boundaries land on the real seams: bun 176..354,
onion+tomato 354..464, cheese+patty 464..579, lettuce 579..642, bottom bun
642..747. Verified in the browser — all five labels point at the right food.

**Five labels, not six.** This burger has no pickle or sauce layer and its
cheddar never separates from the patty, so "Dinamo sos" and a standalone cheddar
label would both point at nothing. The copy was re-cut to match: Brioche pecivo /
Paradajz i crveni luk / 100% goveđe meso (sa topljenim cheddarom) / Hrskava
salata / Tostirano pecivo.

**The sequence.** ScrollTrigger pins the stage and scrubs at 0.6. Progress maps
to a frame position with a hold from 0.40 to 0.60 — a pose that never stops
moving cannot be read, and the point of the beat is to look at the ingredients.
Neighbouring frames cross-dissolve, which is what turns 30 stills into
continuous motion; it has to be `lighter`, not source-over, because the frames
carry alpha and painting one over the other leaves two burgers. Every frame is
preloaded and decoded before the scrub starts. `prefers-reduced-motion` skips
the pin entirely and renders two stills.

**The transition out** — the actual complaint. The pin used to end and the cream
menu simply began. The ticker now carries the boundary on a band that fades from
the story's night blue into the menu's cream, so the colour has already changed
by the time the grid starts.

**Verified in headless Chrome over CDP** (the browser MCP server was
disconnected, so this drives chromium directly — `scripts` for it are throwaway,
in the scratchpad):

- **28 layouts across a 91-step scrub**, 2.5ms of layout total, 0.42ms of script
  per frame. Layout is not running per frame, which is the rule the old version
  broke.
- Loading state confirmed on a throttled production build: progress bar only, no
  half-shown headline or frames.
- Reduced motion: no canvas, no pin, two stills, shorter page.
- Desktop 1440, mobile 390: burger centred and sharp, labels clear of the food
  and inside the viewport at both.

**Two bugs found and fixed by looking at it**, both worth remembering:

- GSAP tweening `y` on the headline overwrote the `translateY(-50%)` that was
  centring it, dropping it half a screen. Centred with flex instead.
- Anything GSAP fades in has to start hidden in CSS, or it flashes at full
  strength while the frames are still downloading.

**Payload:** desktop sequence 624 KB (30 frames), mobile 184 KB (20 frames),
stills 58 KB; JS 327 KB / 112 KB gzip, CSS 12.5 KB. The pipeline originally wrote
a WebP beside every AVIF frame, which nothing fetched — the loader requests AVIF
only, and a browser that cannot decode it falls back to the stills rather than to
a WebP sequence. Dropping them took `public/frames` from 2.9 MB to 1.1 MB.

**Files:** everything. New: `index.html`, `vite.config.ts`, `tsconfig.json`,
`package.json`, `src/**`, `scripts/build-frames.py`, `public/frames/**`,
`README.md`. Removed: `app/`, `worker/`, `db/`, `drizzle/`, `examples/`,
`build/`, `tests/`, `.openai/`, `.sites-runtime/`, `.wrangler/`, `.npmrc`, the
Next/Cloudflare config, both old build scripts, and `HANDOFF.md` (it described
the project that was just replaced; `README.md` supersedes it).

**TODOs:**
- Fixed while porting: the language is now read during initial state instead of
  a `setState` inside an effect, and the headline centring is settled.
- `assets/source/burger-frames.zip` is 58 MB and tracked, consistent with the
  masters that were already tracked. Worth moving to LFS or out of git if the
  repo gets cloned often.
- No analytics. `LocalBusiness`/`Restaurant` JSON-LD was added in `index.html`.

### [2026-08-27] Reverted the footage; kept the engine work

**Changes:** Follow-up to the entry below. Two pieces of feedback: a bad zoom
between beats 3 and 4, and "I preferred the old box animation, we just had
performance problems". The second is decisive — the animation was fine, the code
was not — so the footage goes back and every code fix stays.

- **The footage is restored exactly** from `b92218e`: both master clips, both
  frame sequences, both stills, the generated `burgerFrames.ts` / `finaleFrames.ts`,
  and both build scripts. Restoring rather than rebuilding means no pipeline risk.
  The scripts had to go back too: `LAYER_GROUPS = (1,3,1,1,1,1)` asserts eight
  separated pieces and the old clip gives six, so a rebuild would have hard-failed,
  and the new `BAND_MIN_W` / span-based `find_motion` were tuned against footage
  that no longer exists here.
- **The zoom was mine.** The closing beat is sized to match the burger it takes
  over from, then rescales to a fixed frame. The old box clip's burger fills 57%
  of its frame; the new one's filled 36%, so the element started far larger and
  shrank far further — 1.86x against 1.29x — and the new clip also grew
  internally, so the two compounded. Restoring the footage puts `FINALE_SCALE`
  back to 1.422 and the rescale back to the 1.29x that shipped before, now spread
  over twice as much scrolling because the section is 900svh. Measured across
  stops 2.5 to 3.4: 818px to 636px.
- **`mediaScale` is now self-disabling.** `MEDIA_SCALE = ASSEMBLED_FILL / burgerH`
  came out at 0.81 against the old anchors, which would have *shrunk* a hero that
  was framed correctly to begin with. It is `Math.max(1, ...)` now, so the
  pull-back engages only for footage that spreads far enough to need it and is a
  no-op here. The function is kept — it was right, it just must not fire.
- **The handoff is a swap again, not a cross-fade.** The previous author's note
  was explicit and I overrode it without testing: the closing frames are opaque,
  so blending shows the burger at half strength *and* that sequence's burger at
  half strength, which doubles it. The two beats are aligned to share the same
  burger, which is what makes the cut invisible without a blend.
- `--burger-h` back to 76vh/58vh/42vh, since the old crop is aspect 0.61 rather
  than the 0.43 the raised values were for.

**Kept, and unaffected by the footage:** no layout reads or writes in the
animation loop; labels placed by a single `translate3d`; 900svh with the
hold-based schedule; no speed cap, `FOLLOW_RATE` 11; parallel coarse-to-fine
frame loading with a nearest-loaded fallback; `ASPECT` read from the generated
manifest; progress bar on `scaleY`; halo without a blur filter.

**Added `HANDOFF.md`** — a self-contained brief for rebuilding this site in a
clean project: business facts, the full menu, both translation tables, design
tokens, page structure, the whole animation design and why each part is the way
it is, the matting pipeline, and the traps. Written because the repo is ChatGPT
Sites scaffolding the owner doesn't trust: two build systems (dev is Vite +
vinext + Cloudflare, build is `next build --webpack`), an unused Drizzle/D1
layer, a `worker/`, and a 3,347-file `.sites-runtime/`, none of which `app/`
touches. The app itself is ~1,600 lines and ports cleanly to Vite + React + TS,
so the recommendation is a port, not a rewrite.

**Files:** `app/burgerStory.ts`, `app/globals.css`, new `HANDOFF.md`; reverted
`app/burgerFrames.ts`, `app/finaleFrames.ts`, `scripts/build-*.py`,
`public/burger-seq/`, `public/finale-seq/`, `public/*-still.*`, `assets/source/`

**TODOs:**
- Beats 3 to 4 verified by compositing the real frames at the sizes `apply()`
  computes, not in a browser — this environment cannot deliver scroll or keyboard
  events to the page. Worth one manual scroll-through.
- The `finale-still` generation added to `build-finale-sequence.py` last session
  was reverted with the script. The current still matches the current clip, so it
  is correct today, but it is hand-made and will go stale again if the clip is
  ever replaced. Worth re-applying.
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:91`.

### [2026-08-27] New generated footage, and an animation loop that does no layout

**Changes:** Two complaints — laggy on a phone, and on desktop it "skips phases,
goes too fast, the eye can't see what's happening". Neither was caused by the
footage, so both were fixed in code; the footage was regenerated separately
because it was asked for, and it turned out better and smaller.

**The phone lag was a forced reflow on every animation frame.** `apply()` wrote
styles to ten elements and *then* read `sticky.offsetHeight` and
`burgerRef.offsetHeight`, which makes the browser lay the page out again,
synchronously, before it can answer. It then wrote `top` on six labels, `left`
and `height` on the closing beat, and `height` on the progress bar — all
layout-invalidating. So every frame was a full style recalc plus layout of the
sticky subtree.

- All geometry now lives in a `Metrics` object filled by `measure()`, which runs
  on resize and never inside the loop. Verified: zero layout reads and zero
  non-compositor writes inside `apply` — it is `opacity` and `transform` only.
- Labels are placed by one `translate3d` each, computed in px from the burger box
  measured on resize, instead of a percentage `top` plus two custom properties
  feeding `calc()` in `left`/`right`. The `<=560px` edge-pinned layout moved into
  the same computation rather than a second set of CSS rules.
- The closing beat is sized once per resize and only ever scaled and translated.
  The progress bar is `scaleY` instead of `height`.
- The scroll position is read in the rAF tick, at the top of the frame before any
  write, rather than in the scroll handler — which could fire several times per
  displayed frame, each one a `getBoundingClientRect`.

**"Too fast" was the scroll budget, not the speed.** `.scroll-story` was 500svh
over a 100svh stage: 400svh for four beats, exactly one viewport per beat, and
`frameForStop` was a straight lerp with no dwell, so nothing was ever still.

- 900svh, so a beat is two viewports.
- The schedule now **holds**: apart at 1.0-1.35 with all six labels up, whole
  again at 2.2-2.5. The holds are the animation — without them there is no
  moment for the eye to land on. `labelReveal` used to start fading at stop 1.15,
  before the burger had finished opening, so there was never an instant where all
  six could be read; they are now fully up for a whole viewport of scrolling.
- **`MAX_STOPS_PER_SEC` is gone.** That speed cap kept the burger playing after
  you had stopped scrolling, which is most of what "laggy" described — the
  picture was no longer answering to the hand. With enough scroll length there is
  nothing to fight. The frame-rate-independent exponential follow stays, at
  `FOLLOW_RATE = 11` (~90ms), which is the light smoothing that was asked for.

**Frames load in parallel, coarse-to-fine.** Loading was 56 strictly serial
`await`s, so the end of the story had nothing to draw until the beginning had
finished — scroll down early and the burger sat frozen, which is itself what
"skipping" looks like. Now a bounded pool (6 lanes, 3 on mobile) works through
stride 8, then 4, then 2, then 1: after 14 of 55 fetches the whole sequence is
covered with no gap wider than 4 frames, and the cross-fade already makes a
coarse pass read as continuous motion. A frame that has not arrived draws the
nearest one that has instead of holding the last paint.

**New footage (Higgsfield, ~330 of 3000 credits).** `nano_banana_pro` hero still
on a flat navy backdrop, then `seedance_2_5` `omni_reference` with the still as
both start and end image — which is what makes the clip return exactly to its
first frame — and a `video_extension` for the boxing beat. Two pipeline fixes
were needed and both were real bugs, not accommodations:

- `bands()` counted a row as filled on three opaque pixels, so one narrow drip of
  melted cheese fused the cheddar into the patty. It now needs `BAND_MIN_W` (5%)
  of the width, which separates them and is stable from 4% to 12%.
- `find_motion` used the same metric to find where the explosion *starts*, and it
  is blind there: the burger's height grew 47% (707 -> 1037 rows) while the gap
  metric sat at 2, because the layers were spreading but still touching. It
  picked source frame 24, a quarter into the explosion, so the sequence never
  showed the closed burger. Start is now read from the span and end from the gap
  — each metric where it actually works.
- The clip separates into eight physical pieces, not six, because the lettuce,
  tomato and onion are three objects. `LAYER_GROUPS = (1, 3, 1, 1, 1, 1)` states
  the mapping onto the six labelled ingredients, which is exactly right: those
  three bands *are* "Svježe povrće — hrskava salata, paradajz i crveni luk". The
  build fails loudly if the footage does not give `sum(LAYER_GROUPS)` pieces.

**The camera pulls back as the burger opens.** The frames are cropped to the
union of every pose, and this explosion spreads much further than the old one, so
the assembled burger only fills 37% of the frame — drawn at a fixed size it made
a small hero. `mediaScale()` scales the canvas from 1.77 when whole to 1.0 when
fully apart. It is a transform on a wrapper around the canvas only, so label type
never scales; their anchors are carried through the same scale. `FINALE_SCALE`
and `FINALE_OFFSET` are multiplied by it, since the two beats have to agree on
the burger's size on screen rather than in the frame — verified, both put it at
430px.

`public/finale-still.*` — the closing beat's reduced-motion and no-AVIF fallback
— was a hand-made file the build script never wrote, so it was still showing the
*previous* clip's box on a page whose every other frame had been replaced. The
finale script now generates it alongside the frames it has to match.

Also: the burger/box handoff is a short cross-fade (`finaleTakeover` over a tenth
of a stop) rather than a hard swap; `burgerStory` reads `ASPECT` from the
generated manifest instead of a hardcoded literal, which would have been wrong
after any rebuild; the halo's `filter: blur(14px)` was replaced by wider gradient
stops, since a blurred 44vw layer costs its own render surface.

**Payload went down**, despite the same frame counts: the taller, narrower crop
is mostly transparent and compresses far better. Burger 2483 -> 1547 KB desktop
and 730 -> 513 KB mobile; finale 808 -> 603 KB and 214 -> 168 KB; `public/`
4.97 -> 4.0 MB.

**Files:** `app/ScrollStory.tsx`, `app/FrameSequence.tsx`, `app/burgerStory.ts`,
`app/globals.css`, `scripts/build-burger-sequence.py`,
`scripts/build-finale-sequence.py`, regenerated
`app/burgerFrames.ts`, `app/finaleFrames.ts`, `public/burger-seq/`,
`public/finale-seq/`, `public/{burger,finale}-still.{avif,webp}`, new
`assets/source/burger-master.mp4` and `burger-boxing.mp4`

**Decisions:**
- Frame counts left at 56/35 rather than raised as originally planned. With the
  cross-fade, frame count sets the fidelity of the motion path, not smoothness,
  and each extra desktop frame costs ~1.5 MB of resident `ImageBitmap`. The
  reported problems were pacing and jank; neither is a frame-count problem. It is
  a one-line change in the build script if the motion ever wants more detail.

**TODOs:**
- The beats after the intro were verified by rendering them from the real frames
  with the page's own choreography functions, not in the browser: this
  environment could not deliver scroll or keyboard events to the page (wheel
  ticks moved ~9px and `Page_Down` did nothing). Worth one manual pass through
  the story, particularly the box handoff and the menu wipe.
- The dev server serves 0-byte bodies for files under `public/` after the build
  script deletes and recreates those directories. Restart `npm run dev` after any
  sequence rebuild.
- Pre-existing: `npm test` fails on the host-injected `codex-preview` assertion;
  one lint error at `app/page.tsx:91`.
- Pre-existing: `.story-intro` has `transform: translateY(-50%)` in CSS that the
  loop overwrites from the first frame, so the headline is not actually centred
  on its `top: 50%`. Left as-is — it is how the page has always rendered.

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
