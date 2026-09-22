/**
 * Holds the page still until the first screen can actually be scrolled.
 *
 * It used to wait for every frame of the burger sequence. That is why the
 * headline — the largest thing on the first screen, and so the element
 * largest-contentful-paint is measured on — arrived about two seconds after the
 * first paint: twenty AVIF fetches and decodes stood between the page being
 * painted and the page being shown.
 *
 * What the first screen actually needs is frame 0, the fonts it is set in, and
 * ScrollTrigger, so that the pin exists before the visitor can scroll into it.
 * The rest of the sequence keeps arriving behind the released page, and
 * `FrameCanvas` clamps a scrub to the frames that have decoded, so scrolling
 * early shows the last real frame rather than a hole. On a connection slow
 * enough for that to be visible, the loader is still on screen anyway.
 *
 * Two details in the lock itself matter:
 *
 *  - `scrollRestoration` is set to manual and the page is scrolled to the top.
 *    A reload otherwise restores the previous offset, which fights the lock and
 *    lands the visitor inside a pinned section whose frames do not exist yet.
 *  - The lock is applied in a layout effect, before the browser paints, so
 *    there is no frame in which the page can be scrolled.
 *
 * On release ScrollTrigger is refreshed — it may have measured its triggers
 * while the page was locked — and only then is the scroll normalizer allowed
 * to take over, so the lock and the normalizer are never both holding the page.
 */

import { useEffect, useLayoutEffect, useState } from "react";

import { prefersReducedMotion } from "./prefersReducedMotion";
import { enableNormalizedScroll, loadScrollKit, refreshScrollTriggers } from "./scrollConfig";

/** matches the fade in .preloader — long enough to read as a fade, not a cut */
const FADE_MS = 420;

export type Boot = {
  /** true once everything the first screen needs is decoded */
  readonly ready: boolean;
  /** true once the loader has finished fading and is gone */
  readonly dismissed: boolean;
};

/** resolves when webfonts have loaded, so nothing is measured against a fallback face */
function useFontsReady(): boolean {
  const [loaded, setLoaded] = useState(() => !document.fonts);
  useEffect(() => {
    if (!document.fonts) return;
    let live = true;
    document.fonts.ready.then(() => { if (live) setLoaded(true); })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  return loaded;
}

/**
 * Resolves when GSAP and ScrollTrigger have arrived.
 *
 * Part of the gate because the page must not be scrollable before the pins
 * exist: without this the story section would scroll like an ordinary tall
 * section for as long as the chunk took to load.
 *
 * Under reduced motion there is no pinning, no scrub and no trigger at all —
 * both stories render their stills — so the chunk is never requested.
 */
function useScrollKitReady(): boolean {
  const [loaded, setLoaded] = useState(prefersReducedMotion);
  useEffect(() => {
    if (prefersReducedMotion) return;
    let live = true;
    loadScrollKit().then(() => { if (live) setLoaded(true); })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  return loaded;
}

export function useBoot(firstFrameSettled: boolean): Boot {
  const fontsReady = useFontsReady();
  const scrollReady = useScrollKitReady();
  const ready = firstFrameSettled && fontsReady && scrollReady;
  const [dismissed, setDismissed] = useState(false);

  // before the first paint, so there is no frame in which the page can scroll
  useLayoutEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  // release: let the loader fade, then unmount it and hand scrolling back
  useEffect(() => {
    if (!ready || dismissed) return;
    const timer = window.setTimeout(() => setDismissed(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [ready, dismissed]);

  useEffect(() => {
    if (!dismissed) return;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "";
    body.style.overflow = "";
    if (prefersReducedMotion) return;
    void refreshScrollTriggers().then(enableNormalizedScroll);
  }, [dismissed]);

  return { ready, dismissed };
}
