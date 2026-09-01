# Dinamo Orašje — project brief for a fresh build

Paste this whole file into a new Claude Code session as the opening prompt. It is
self-contained: it assumes you have the old repo available to copy files from,
but everything you need to *decide* is written down here.

---

## The job

Rebuild the Dinamo Orašje website in a clean project. It is **one static page**
for a burger-and-ice-cream shop in Bosnia, and its centrepiece is a scroll-driven
animation of a burger coming apart into its ingredients and settling into a box.

The existing site works and looks right. It was scaffolded by ChatGPT Sites and
carries a lot of machinery nobody chose: two build systems (`npm run dev` is Vite
+ vinext + Cloudflare Workers, `npm run build` is `next build --webpack`), an
unused Drizzle/D1 database layer, a `worker/`, a `.sites-runtime/` with 3,347
files, a stale `dist/`, and a `chatgpt-auth.ts`. None of it is touched by the
page. **This is a port, not a redesign** — the design, copy and animation are
settled and should come across as they are.

**Target stack: Vite + React + TypeScript**, static build, no server, no
framework routing. The page is already React, so the port is close to
copy-and-paste, and the whole config should fit in one readable file. Deploy the
`dist/` folder anywhere (Cloudflare Pages, Netlify, GitHub Pages).

### Port these

`app/ScrollStory.tsx`, `app/FrameSequence.tsx`, `app/burgerStory.ts`,
`app/burgerFrames.ts`, `app/finaleFrames.ts`, `app/globals.css`, `app/page.tsx`,
`scripts/build-burger-sequence.py`, `scripts/build-finale-sequence.py`,
everything in `public/`, and `assets/source/*.mp4` (the master clips, not served
— kept only so the sequences can be rebuilt).

### Drop these

`worker/`, `db/`, `drizzle/`, `drizzle.config.ts`, `examples/`, `build/`,
`dist/`, `.openai/`, `.sites-runtime/`, `.wrangler/`, `vite.config.ts` (write a
fresh one), `app/chatgpt-auth.ts`, `app/layout.tsx` (becomes `index.html`), and
every Next/Cloudflare/Drizzle dependency in `package.json`.

---

## The business

- **Dinamo** — hamburgers and ice cream, Orašje, Bosnia and Herzegovina.
- Address: **Donja Mahala, Ulica Školska 18, Orašje**
- Phone: **063553739** (used as `tel:063553739`)
- Instagram: **@slasticarnadinamo** — https://www.instagram.com/slasticarnadinamo
- Open **every day, 08:00 — 23:00**
- Bilingual **Bosnian / English**, BS is the default, the choice is remembered in
  `localStorage` under `dinamo-language`, and `document.documentElement.lang` is
  kept in sync.
- Logo: `public/dinamo.jpg` (the Dinamo Zagreb-style crest). Favicon
  `public/favicon.svg`. Social card `public/og.jpg`.

---

## Menu (14 items)

Images live at `public/menu/<category>-<slug>.avif`, 520×520, lazy-loaded.

| Category | Bosnian | English | Price | Note |
|---|---|---|---|---|
| ice | Vanilja | Vanilla | 1.5 KM | |
| ice | Nutella | Nutella | 1.5 KM | |
| ice | Lješnjak | Hazelnut | 1.5 KM | |
| ice | Čokolada | Chocolate | 1.5 KM | |
| ice | Jagoda | Strawberry | 1.5 KM | |
| ice | Limun | Lemon | 1.5 KM | |
| burgers | Hamburger | Hamburger | 5 KM | |
| burgers | Cheeseburger | Cheeseburger | 6 KM | |
| burgers | Double hamburger | Double hamburger | 9 KM | |
| drinks | Limunada | Lemonade | 1.5 KM | 200 ml |
| drinks | Cola | Cola | 2.5 KM | 250 ml |
| drinks | Fanta | Fanta | 2.5 KM | 250 ml |
| drinks | Voda | Water | 2 KM | 500 ml |
| drinks | Ice tea | Iced tea | 2.5 KM | |

Filters: `all · burgers · ice · drinks` → BS `Sve · Burgeri · Sladoled · Pića`,
EN `All · Burgers · Ice cream · Drinks`.

---

## Copy — do not re-invent this

**Bosnian**

```
menu "Meni" · location "Lokacija" · call "Pozovi"
open "Orašje · od 08 do 23h"
headline ["Glad ne", "čeka."]
intro "Skrolaj i upoznaj naš burger."
nothingHidden "NIŠTA NE KRIJEMO" · layerByLayer "Sloj po sloj."
simple "JEDNOSTAVNO. SVJEŽE. UKUSNO." · inPlace "Sve na svom mjestu."
scrollOpen "SKROLAJ DA OTVORIŠ BURGER" · ingredientsStep "NAŠI SASTOJCI"
assembling "SASTAVLJAMO" · menuBelow "MENI JE ISPOD"
ticker "BURGERI ✦ SLADOLED ✦ DOBAR OSJEĆAJ ✦ BURGERI ✦ SLADOLED ✦"
choose "IZABERI SVOJ FAVORIT" · ourMenu "Naš meni" · filterLabel "Filtriraj meni"
where "GDJE SMO?" · seeYou ["Vidimo se", "u Dinamu."]
country "Bosna i Hercegovina" · everyDay "SVAKI DAN" · callUs "Pozovi nas"
backTop "NA VRH ↑" · logoLine "HAMBURGERI · SLADOLED · ORAŠJE"
```

Ingredient labels, top to bottom — these pair with the six animation layers:

```
1 "Brioche pecivo"     "Mekano, zlatno i uvijek svježe."
2 "Svježe povrće"      "Hrskava salata, paradajz i crveni luk."
3 "Topljeni cheddar"   "Kremasti sloj koji veže svaki zalogaj."
4 "100% goveđe meso"   "Sočno, začinjeno i pečeno na grilu."
5 "Dinamo sos"         "Kiseli krastavci i naš sočni potpis."
6 "Tostirano pecivo"   "Čvrsta baza za burger bez kompromisa."
```

`burgerAria` "Dinamo burger koji se rastavlja na šest svježih sastojaka"
`boxAria` "Dinamo burger se slaže i zatvara u kutiju s logom"

**English**

```
menu "Menu" · location "Location" · call "Call us"
open "Orašje · open 8am–11pm"
headline ["Hunger", "won't wait."]
intro "Scroll to discover our burger."
nothingHidden "NOTHING TO HIDE" · layerByLayer "Layer by layer."
simple "SIMPLE. FRESH. DELICIOUS." · inPlace "Everything in place."
scrollOpen "SCROLL TO OPEN THE BURGER" · ingredientsStep "OUR INGREDIENTS"
assembling "ASSEMBLING" · menuBelow "THE MENU IS BELOW"
ticker "BURGERS ✦ ICE CREAM ✦ GOOD VIBES ✦ BURGERS ✦ ICE CREAM ✦"
choose "CHOOSE YOUR FAVORITE" · ourMenu "Our menu" · filterLabel "Filter menu"
where "FIND US" · seeYou ["See you", "at Dinamo."]
country "Bosnia and Herzegovina" · everyDay "EVERY DAY" · callUs "Call us"
backTop "BACK TO TOP ↑" · logoLine "BURGERS · ICE CREAM · ORAŠJE"

1 "Brioche bun"        "Soft, golden and always fresh."
2 "Fresh vegetables"   "Crisp lettuce, tomato and red onion."
3 "Melted cheddar"     "A creamy layer that holds every bite together."
4 "100% beef"          "Juicy, seasoned and flame-grilled."
5 "Dinamo sauce"       "Pickles and our signature juicy finish."
6 "Toasted bun"        "A solid base for a no-compromise burger."

burgerAria "Dinamo burger separating into six fresh ingredient layers"
boxAria    "The Dinamo burger settling into a branded box"
```

---

## Design

```css
--blue:  #082e68    --red:  #d80d16    --cream: #f2ead8
--gold:  #d7b767    --ink:  #11120f
```

- Type: **Archivo**, self-hosted (no third-party request, no FOUT), weights
  400–900 variable, in **two subsets**: `archivo-latin.woff2` and
  `archivo-latin-ext.woff2`. The latin-ext subset is what carries **Č Ć Ž Š Đ** —
  do not drop it, the Bosnian copy needs it.
- The story headline is `clamp(64px, 8.4vw, 146px)` at `line-height: .94`. **That
  .94 is a floor**: Archivo's caron on Č rises past the cap height and a tighter
  line-height makes it collide with the line above.
- The story stage background is a radial gradient centred at 54% 50%:
  `#0a58a5 → #073a78 31% → #041d42 67% → #031329 100%`.
- All styling is hand-written CSS in one file. Tailwind is imported in the old
  project but essentially unused — do not carry it over.

---

## Page structure

Fixed nav → **scroll story** → red ticker → menu grid → location → footer.

1. **Nav** — fixed, 88px, transparent over the story, gains
   `background:#061f49f2` + `backdrop-filter:blur(14px)` once `scrollY > 40`.
   Brand, `Meni`/`Lokacija` anchors, BS/EN switch, red "Pozovi" call button.
2. **Scroll story** — see below. This is the hero.
3. **Ticker** — red marquee, `margin-top:-2px` and `rotate(-1deg)`, positioned so
   **the red menu wipe at the end of the story runs straight into it**. That
   continuity is deliberate; keep the wipe colour and the ticker colour identical.
4. **Menu** — filter buttons + card grid, 520px AVIF thumbnails, price per card.
5. **Location** — address, hours, call + Instagram buttons, and a logo panel.
6. **Footer** — brand, `© 2026 Dinamo Orašje`, back-to-top.

Secondary reveals in the menu/location use native CSS scroll-driven animations
(`animation-timeline: view()`) behind an `@supports` guard. No JS, no observer.

---

## The animation — the part that matters

A `900svh` section containing a `100svh` `position: sticky` stage. Scroll
progress through the section maps to a position `0 → 4` called a **stop**. Five
beats, but the schedule is **not** evenly spaced, and the spacing is the design:

```
0     → 1.0    the burger comes apart
1.0   → 1.35   HOLD — apart, all six ingredient labels readable
1.35  → 2.2    it goes back together
2.2   → 2.5    HOLD — whole again
2.5   → 3.4    it settles into a branded box (a second sequence takes over)
3.4   → 4      a red MENU panel wipes up over everything
```

**The holds are the animation.** Without them the whole thing is one unbroken
slide from first frame to last, and at reading speed the eye never gets a still
picture to land on — which reads as "it goes too fast, I can't see what's
happening". Two viewports of scrolling per stop, and each pose arrives and then
sits. Beats ease in and out (smoothstep) so they decelerate into their holds.

### How it is drawn

Not a video. **A sequence of AVIF stills blitted onto a `<canvas>`.** Seeking a
video (`video.currentTime = …`) sends the decoder back to the previous keyframe
on every scroll tick, which janks everywhere and does not work at all on iOS
Safari. An already-decoded frame costs nothing to blit, so the picture tracks the
scrollbar exactly.

- Burger sequence: 56 frames desktop (480px wide), 35 mobile (340px), **with an
  alpha channel** so the burger sits on the page's own gradient.
- Box sequence: 52 frames desktop (720px square), 32 mobile (460px), **opaque** —
  the clip was shot on a flat studio colour and the page fades its background to
  exactly that colour first, so the frames can be drawn with no visible edge. An
  opaque frame is ~5 KB against ~44 KB with alpha.
- Fractional positions **cross-dissolve the two frames they fall between**. A few
  dozen stills over several screens of scrolling means each is held for many
  display frames and the motion visibly steps; dissolving removes that for free.
  It must be a real linear dissolve — draw A at `1-t`, then B at `t` with
  `globalCompositeOperation = "lighter"`, giving `A*(1-t) + B*t` including alpha.
  Painting B over A with source-over leaves A's burger fully opaque underneath
  and you see **two burgers**.
- Frames load in a bounded pool (6 lanes, 3 on mobile) in **coarse-to-fine order**
  — stride 8, then 4, then 2, then 1 across the whole sequence. Loading
  0,1,2,…,n means the end of the story has nothing to draw until the beginning
  finishes, so scrolling down early leaves the burger frozen. Coarse-to-fine
  makes the entire story scrubbable after ~14 of 55 fetches. A frame that has not
  arrived draws the nearest one that has.
- Reduced motion, or any AVIF decode failure, falls back to a still `<picture>`.

### How it follows the scroll

The animation eases towards the scroll position rather than being pinned to it:
`shown += (target - shown) * (1 - exp(-RATE * dt))` with `RATE = 11`, which is
about 90 ms to close 63% of a gap. Exponential in **elapsed time**, not per
frame, or it runs twice as fast on a 120 Hz display.

**Do not add a speed limit.** An earlier version capped how many stops per second
the story could advance, so a hard flick left the burger still playing after the
user had stopped scrolling. That reads as lag — the picture stops answering to
the hand. With enough scroll length there is nothing to fight.

### The one hard rule

**Nothing in the animation loop may read or write layout.**

The single worst bug in the old version: `apply()` wrote styles to ten elements
and *then* read `offsetHeight`, which forces the browser to lay the page out
again, synchronously, mid-frame. It also wrote `top` on six labels, `left` and
`height` on the box element, and `height` on the progress bar — all
layout-invalidating. Every animation frame was a full style recalc plus layout of
the sticky subtree. On a mid-range phone that is the entire frame budget.

The shape that works:

- All geometry (stage height, scroll travel, burger box, label widths and
  heights) is measured **once per resize** into a `Metrics` object, and read from
  there inside the loop.
- The loop writes **only `opacity` and `transform`**. Labels get one
  `translate3d` each, computed in px from the measured burger box. The box
  element is sized once and then only scaled and translated. The progress bar is
  `scaleY`, not `height`.
- The scroll position is read with **one** `getBoundingClientRect()` at the top
  of the rAF tick, before any write — never in the scroll handler, which can fire
  several times per displayed frame.
- No React state in the loop. React builds the structure and swaps copy on a
  language change; the loop writes to refs directly. Re-rendering twenty-odd
  elements sixty times a second to move a number is the most expensive thing a
  page like this can do.

### Other details worth keeping

- Six ingredient labels alternate left and right of the burger and track their
  layer's vertical centre, with a rule that runs to that layer's edge. Below
  560px they pin to the frame edges instead, because there is no room beside the
  food at that width.
- The box sequence is **swapped in, not cross-faded**. Its frames are opaque, so
  blending shows the burger at half strength *and* the box frame's burger at half
  strength — one burger becomes two. The two sequences are scaled and offset from
  measured anchors to share the same burger at the handoff, which makes the cut
  invisible without any blend.
- There is a `mediaScale()` that scales the picture up while the burger is whole
  and eases to 1 as the layers spread — a camera pull-back. It is a **no-op for
  the current footage** (`Math.max(1, …)`), because this clip's assembled burger
  already fills most of its frame. It exists for footage that spreads far enough
  that the assembled burger would otherwise be a small hero. Keep the guard.
- Decorative layers that fade continuously (`--story-grid`, `--story-halo`, the
  studio backdrop) carry `will-change: opacity` so their masks rasterise once.
- No `filter: blur()` on anything that animates — a blurred 44vw layer costs its
  own render surface, and a `drop-shadow` over a canvas that repaints every frame
  makes the browser re-blur its alpha every frame.

---

## The asset pipeline (`scripts/*.py`)

The least reproducible part of the project. Requires `ffmpeg`, `avifenc`
(libavif) and `numpy`. Both scripts read a master `.mp4` from `assets/source/`
and write the frame sequences plus a generated `.ts` file of geometry.

**`build-burger-sequence.py`** cuts the burger out by **difference matting**. The
clip renders the burger over a fixed backdrop, so the backdrop is reconstructed
per-pixel by median across frames, then a radial model is fitted to fill the
middle the burger never clears (residual ~1/255). Anything differing from that
plate is burger, which keeps the exact artwork instead of regenerating it and
yields a real alpha channel. It also:

- detects the explode and reassemble runs and skips the clip's static holds;
- finds the six ingredient layers as horizontal bands in the alpha and exports,
  per frame, each layer's centre and left/right extent — that is what lets a
  label sit level with its layer and run its rule to the layer's edge;
- exports `ASPECT`, frame counts, a desktop→mobile frame map, and the anchor of
  the assembled burger used to line the box sequence up.

**Two tuning facts, both learned the hard way:**

- A row only counts as part of a layer if a real fraction of the frame width is
  opaque there (~5%). With a bare "more than three pixels" test, one narrow drip
  of melted cheese bridges the gap and fuses two layers into one.
- Where the explosion **starts** must be measured from the burger's overall
  height, and where it **ends** from the empty space between layers. Neither
  works at both ends: at the start the layers are spreading but still touching,
  so a gap metric reads zero while the height has already grown 47%; at the end
  the outer buns reached their final positions long ago, so the height has
  plateaued while the gap is still growing.

If the footage is ever regenerated, the clip must have: a locked-off camera (no
pan/zoom/drift at all), one constant flat backdrop, the burger fully in frame at
maximum separation, no motion blur, no steam, no flying crumbs, and layers that
separate into clearly readable bands. Generation wants to split lettuce, tomato
and onion into three separate objects; the script takes an explicit grouping
constant that maps physical pieces onto the six labelled ingredients.

`ffmpeg`'s AVIF muxer **drops the alpha plane** — frames must be handed to
`avifenc` as PNG. And the box sequence's fallback still has to be *generated* by
the script, not made by hand: it was once hand-made, and then silently showed the
wrong box after the clip was replaced.

---

## Traps

- The story's scroll denominator must be measured from an element sized in
  `svh`, **not `window.innerHeight`** — `innerHeight` grows as a phone's URL bar
  collapses, so a denominator mixing the two moves mid-scroll and progress jumps.
  Visible as a stutter on mobile and nowhere else.
- Always write a `vh` fallback line before every `svh` line. Safari <15.4 and
  Chrome <108 drop the whole declaration, which would leave the sticky stage with
  no height.
- `scrollTo({behavior: "auto"})` is **not** instant — it defers to the element's
  `scroll-behavior`, which is `smooth` here for the nav anchors. Use
  `behavior: "instant"`.
- A dev server may serve **0-byte bodies** for files under `public/` after a build
  script deletes and recreates those directories. Restart it after any rebuild.

---

## Known issues to fix during the port

- `page.tsx` calls `setState` synchronously inside an effect to restore the saved
  language — it should read `localStorage` during the initial state instead.
- `.story-intro` has `transform: translateY(-50%)` in CSS that the animation loop
  overwrites from its first frame, so the headline is not actually centred on its
  `top: 50%`. Decide which is wanted rather than leaving both.
- The site has no analytics, no sitemap and no structured data. A local business
  page should probably have `LocalBusiness` JSON-LD with the address, hours and
  phone.
