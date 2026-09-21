/**
 * True once an element has come within a screen or two of the viewport, and
 * true forever after.
 *
 * Used to decide when a below-the-fold sequence is allowed to start fetching.
 * The margin is deliberately generous: the point is not to load the frames as
 * late as possible, it is to load them off the critical path but still well
 * before the visitor can reach them, so the sequence is never actually seen
 * waiting.
 *
 * One-shot — it disconnects on the first intersection, because a sequence that
 * has been fetched does not need fetching again when it scrolls back out.
 */

import { useEffect, useState, type RefObject } from "react";

/** roughly a screen and a half of runway before the section arrives */
const ROOT_MARGIN = "150% 0px";

export function useNearViewport(
  ref: RefObject<Element | null>,
  enabled: boolean,
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!enabled || near) return;
    const el = ref.current;
    if (!el) return;
    // no IntersectionObserver: load immediately rather than never
    if (typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: ROOT_MARGIN });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled, near]);

  return near;
}
