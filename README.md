# Dinamo — Animated Restaurant Website

A bilingual (Bosnian/English), scroll-driven restaurant website for Dinamo in
Orašje. Built with React, Next.js and CSS, with an optional Vinext/Vite setup
for Cloudflare-based previews.

## Features

- Scroll-controlled six-layer burger assembly
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
- Images and burger layers: `public/`

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
