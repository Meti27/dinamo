# Dinamo — Animated Restaurant Website

A bilingual (Bosnian/English), scroll-driven restaurant website for Dinamo in
Orašje. Built with React, Next.js and CSS, with an optional Vinext/Vite setup
for Cloudflare-based previews.

## Features

- Scroll-scrubbed burger that comes apart into its six layers and back together
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

## The burger animation

The hero burger is a frame sequence drawn onto a `<canvas>`, scrubbed by scroll
position. Scrubbing a video instead (`video.currentTime = …`) makes the decoder
seek back to a keyframe on every scroll tick, which stutters on desktop and does
not work at all on iOS Safari.

- `app/BurgerSequence.tsx` — preloads the frames and blits them to the canvas
- `app/burgerStory.ts` — when each beat happens, and where the labels sit
- `app/burgerFrames.ts` — generated geometry; do not edit by hand
- `public/burger-seq/` — the frames themselves (AVIF with alpha, ~1.5 MB desktop
  / ~0.5 MB mobile), plus `public/burger-still.*` for reduced-motion visitors

To retime the animation without touching any images, edit `BEATS` in
`app/burgerStory.ts` and `.scroll-story { height }` in `app/globals.css`.

To rebuild the frames from the master clip:

```bash
python3 scripts/build-burger-sequence.py
```

That cuts the burger out of `assets/source/burger-master.mp4` by difference
matting — the clip's blue backdrop never moves, so it can be reconstructed and
subtracted, giving a real alpha channel. The script rewrites `public/burger-seq/`
and `app/burgerFrames.ts`. `assets/` is not served; it exists only for rebuilds.

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
