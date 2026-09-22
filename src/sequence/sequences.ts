/**
 * Every scroll sequence on the page, in one place.
 *
 * A sequence is a directory under `public/` with `mobile/` and `desktop/`
 * subdirectories of `f00.avif`…, plus how many frames each set has. Dropping in
 * a regenerated set is then a two-number edit here (or in the generated
 * `frames.ts` / `iceFrames.ts` the build scripts write, which is where the
 * counts come from), and nothing else in the app needs to know.
 *
 * `preloadHref` exists so index.html and the loader cannot disagree about which
 * file is frame 0 — the preload in the document has to name the same URL the
 * loader will fetch, or the browser fetches it twice.
 */

import { DESKTOP_COUNT as BURGER_DESKTOP, MOBILE_COUNT as BURGER_MOBILE } from "../frames";
import { DESKTOP_COUNT as ICE_DESKTOP, MOBILE_COUNT as ICE_MOBILE } from "../iceFrames";
import type { FrameSource } from "./useFrameLoader";

/** the first screen: loaded eagerly, and what the boot gate waits for */
export const BURGER_FRAMES: FrameSource = {
  dir: "frames",
  desktopCount: BURGER_DESKTOP,
  mobileCount: BURGER_MOBILE,
};

/** below the fold: loaded once the page has booted and the section is near */
export const ICE_FRAMES: FrameSource = {
  dir: "icecream",
  desktopCount: ICE_DESKTOP,
  mobileCount: ICE_MOBILE,
};

/** the URL of frame 0 for a set, for `<link rel="preload">` */
export function preloadHref(source: FrameSource, variant: "mobile" | "desktop") {
  return `/${source.dir}/${variant}/f00.avif`;
}
