/**
 * Holds the page still until the first sequence is ready to run.
 *
 * The brief is that nothing should ever be seen half-loaded. Until now each
 * story fetched its own frames and showed a small bar inside its own stage,
 * which meant the page was scrollable while the burger was still decoding —
 * and scrolling into a sequence that has no frames yet is exactly the
 * half-loaded state the bar was there to avoid.
 *
 * So scrolling is locked from the first paint and released once the burger
 * frames are decoded and the fonts have loaded. Two details matter:
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

import { ScrollTrigger, enableNormalizedScroll } from "./scrollConfig";

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

export function useBoot(framesSettled: boolean): Boot {
  const fontsReady = useFontsReady();
  const ready = framesSettled && fontsReady;
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
    // the triggers may have been measured while the page was locked
    ScrollTrigger.refresh();
    enableNormalizedScroll();
  }, [dismissed]);

  return { ready, dismissed };
}
