/**
 * Loads GSAP and ScrollTrigger on demand, registers the plugin and configures
 * it for mobile — once, however many callers ask.
 *
 * Why on demand: GSAP and ScrollTrigger are about a third of the JavaScript
 * this page ships, and nothing on the first screen needs either of them. The
 * first screen is a headline and one frame of a canvas; the pinned scrubbing
 * cannot start until the frames are decoded anyway. Static imports put all of it
 * in front of the first paint, which is the largest-contentful-paint element.
 * A dynamic import lets the headline paint while GSAP is still arriving.
 *
 * `ignoreMobileResize` is the important part of the configuration. On a phone
 * the address bar sliding in and out fires a window resize, and a resize makes
 * ScrollTrigger recalculate every trigger's start and end — while the user is
 * mid-scroll, on the main thread, with two pinned sections on the page. That is
 * a refresh cascade caused by nothing the page actually did, and it is the
 * classic reason a pinned scroll site feels fine on a desktop and drops frames
 * on a phone. The flag tells ScrollTrigger to ignore a resize that only changed
 * the viewport height on a touch device, which is exactly the address bar case.
 * A real orientation change still refreshes.
 */

type Gsap = (typeof import("gsap"))["default"];
type ScrollTriggerStatic = (typeof import("gsap/ScrollTrigger"))["ScrollTrigger"];

export type ScrollKit = {
  readonly gsap: Gsap;
  readonly ScrollTrigger: ScrollTriggerStatic;
};

let pending: Promise<ScrollKit> | null = null;

export function loadScrollKit(): Promise<ScrollKit> {
  pending ??= (async () => {
    const [core, plugin] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]);
    const gsap = core.default;
    const { ScrollTrigger } = plugin;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    return { gsap, ScrollTrigger };
  })();
  return pending;
}

/**
 * Hand *touch* scrolling to GSAP, and keep the coast short.
 *
 * Two things about `normalizeScroll(true)` are wrong for this site, and both
 * are its defaults rather than anything clever:
 *
 *  - it intercepts `"wheel,touch"`, so it takes over a desktop mouse wheel as
 *    well, which it has no reason to. The burst-delivery problem it exists to
 *    solve is a touch problem. Restricted to `"touch"`, a desktop wheel is
 *    handled by the browser exactly as it was before any of this.
 *  - its momentum tween runs for 2.8 seconds. That is far longer than the
 *    platform's own glide, and a page that keeps travelling for nearly three
 *    seconds after the finger has gone reads as sluggish and out of your
 *    control -- the opposite of what this was added for.
 *
 * 0.65s is close to a native flick: the normalizer still owns the scroll
 * position during the gesture, which is the part that keeps a pinned canvas in
 * step, but it stops coasting about when you expect it to.
 *
 * Note this is not a speed multiplier -- there isn't one. How far a flick
 * travels is set by its velocity either way; this only bounds how long the
 * page keeps moving once you let go.
 */
export async function enableNormalizedScroll() {
  const { ScrollTrigger } = await loadScrollKit();
  ScrollTrigger.normalizeScroll({ type: "touch", momentum: 0.65 });
}

/** re-measure every trigger — the triggers may have been measured while locked */
export async function refreshScrollTriggers() {
  const { ScrollTrigger } = await loadScrollKit();
  ScrollTrigger.refresh();
}
