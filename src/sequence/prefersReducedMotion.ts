/**
 * Whether the visitor has asked for reduced motion, read once.
 *
 * Both stories and the boot gate need the same answer, and none of them
 * subscribes to it changing — a visitor who flips the OS setting mid-scroll
 * gets the new behaviour on the next load, which is what the previous
 * inline `matchMedia` calls did too, only re-evaluated on every render.
 */
export const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
