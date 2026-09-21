/**
 * Registers ScrollTrigger and configures it for mobile, once.
 *
 * `ignoreMobileResize` is the important part. On a phone the address bar
 * sliding in and out fires a window resize, and a resize makes ScrollTrigger
 * recalculate every trigger's start and end — while the user is mid-scroll,
 * on the main thread, with two pinned sections on the page. That is a
 * refresh cascade caused by nothing the page actually did, and it is the
 * classic reason a pinned scroll site feels fine on a desktop and drops
 * frames on a phone.
 *
 * The flag tells ScrollTrigger to ignore a resize that only changed the
 * viewport height on a touch device, which is exactly the address bar case
 * and nothing else. A real orientation change still refreshes.
 *
 * Both stories import this for its side effect rather than calling
 * registerPlugin themselves, so the configuration cannot be applied twice or
 * be missed by one of them.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.config({ ignoreMobileResize: true });

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
export function enableNormalizedScroll() {
  ScrollTrigger.normalizeScroll({ type: "touch", momentum: 0.65 });
}

export { ScrollTrigger };
