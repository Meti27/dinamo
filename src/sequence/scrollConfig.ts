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

export { ScrollTrigger };
