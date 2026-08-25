# Dinamo — Animated Restaurant Website

A bilingual (Bosnian/English), scroll-driven restaurant website for Dinamo in
Orašje. Built with React, Next.js and CSS, with an optional Vinext/Vite setup
for Cloudflare-based previews.

## Features

- Scroll-scrubbed burger that comes apart into its six layers, reassembles, and
  is packed into a branded Dinamo box
- Self-hosted Archivo typeface with full Bosnian diacritic coverage
- Bosnian / English language switcher
- Responsive layouts for desktop, tablet and mobile
- Filterable food, ice-cream and drinks menu
- Restaurant phone, Instagram, address and opening hours
- Reduced-motion accessibility support
- Open Graph social-sharing artwork

## Requirements

- Node.js 22.13 or newer
- npm
- Linux or WSL is recommended for the included build scripts
- Only to rebuild the burger animation: `ffmpeg`, `avifenc` (libavif) and Python
  with `numpy`. Not needed for normal development — the frames are committed.

## Run locally

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal.

## Production build

```bash
npm run build
npm run start
```

## Edit the website

- Main page and translations: `app/page.tsx`
- Styling and responsive breakpoints: `app/globals.css`
- Browser metadata: `app/layout.tsx`
- Menu photography and other images: `public/`

## The scroll story

The hero animation is two image sequences drawn onto a `<canvas>` and scrubbed by
scroll position. Scrubbing a video instead (`video.currentTime = …`) makes the
decoder seek back to a keyframe on every tick, which stutters on desktop and does
not work at all on iOS Safari. Blitting an already-decoded frame is what keeps it
smooth on a phone.

The story runs: burger assembled → comes apart into six labelled layers → back
together → settles into a Dinamo box → the menu wipe.

- `app/FrameSequence.tsx` — preloads frames and blits them; used for both beats
- `app/burgerStory.ts` — beat timing, label anchoring, and the geometry that
  lines the closing beat up with the burger it takes over from
- `app/burgerFrames.ts`, `app/finaleFrames.ts` — generated; do not edit by hand
- `public/burger-seq/` — the layer beat (AVIF **with alpha**, cut out so it sits
  on the page's own gradient)
- `public/finale-seq/` — the boxing beat (AVIF, **opaque**). The box is navy on a
  navy backdrop and will not difference-matte cleanly, so instead the page fades
  its background to exactly the studio colour the clip was shot on and the frames
  are drawn as-is. An opaque frame also costs ~5 KB against ~44 KB with alpha.
- `public/burger-still.*`, `public/finale-still.*` — reduced-motion fallbacks

To retime the story without touching any images, edit `BEATS` in
`app/burgerStory.ts` and `.scroll-story { height }` in `app/globals.css`.

To rebuild the frames from the master clips:

```bash
python3 scripts/build-burger-sequence.py    # the layer beat
python3 scripts/build-finale-sequence.py    # the boxing beat
```

The first cuts the burger out of `assets/source/burger-master.mp4` by difference
matting — that clip's backdrop never moves, so it can be reconstructed and
subtracted, giving a real alpha channel. The second flattens the faint gradient
out of `assets/source/burger-boxing.mp4`'s backdrop so the page can match it with
one flat colour. Both scripts also rewrite their generated `app/*Frames.ts`.
`assets/` is not served; it exists only for rebuilds.

The Dinamo crest on the box lid is the real crest, composited onto the generated
packaging rather than drawn by the model, so it stays accurate.

## Deployment options

### ChatGPT Sites

The project is already deployed through ChatGPT Sites. The simplest production
setup is to keep that deployment and connect a custom domain in the Site
settings.

### GitHub and another host

1. Create an empty GitHub repository.
2. Extract this project and open a terminal in its folder.
3. Run:

```bash
git init
git add .
git commit -m "Initial Dinamo website"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

4. Import the repository into Vercel and leave the framework preset set to
   **Next.js**.
5. Use `npm ci` as the install command and `npm run build` as the build command.
   Leave **Output Directory** blank so Vercel uses Next.js' `.next` directory.

## Business details

- Phone: 063 553 739
- Address: Donja Mahala, Ulica Školska 18, Orašje
- Hours: 08:00–23:00 every day
- Instagram: `slasticarnadinamo`
