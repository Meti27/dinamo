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
 * Hand touch scrolling to GSAP.
 *
 * This is the one change here with a real trade-off. normalizeScroll takes
 * the scroll position away from the browser and drives it from GSAP's ticker,
 * which removes the difference between when the browser scrolls and when the
 * scrub is allowed to react -- on iOS in particular, native momentum scrolling
 * delivers scroll events in bursts that a pinned canvas cannot keep up with.
 *
 * The cost is that scrolling no longer feels like the operating system's. On a
 * site that is mostly pinned canvas that usually reads as an improvement; on
 * the reading sections further down it can read as hijacked. It is isolated in
 * its own commit for exactly that reason -- revert this commit alone if the
 * phone says it feels worse.
 *
 * It is deliberately not enabled at import time: the preloader locks scrolling
 * until the first sequence is decoded, and normalizer and lock must not both
 * be holding the page at once. `enableNormalizedScroll` is called once the
 * lock is released.
 */
export function enableNormalizedScroll() {
  ScrollTrigger.normalizeScroll(true);
}

export { ScrollTrigger };
