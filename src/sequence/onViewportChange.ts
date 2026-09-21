/**
 * Calls back when the viewport really changed, and not when it only looked
 * like it did.
 *
 * Both stories re-measure on resize, and measuring is the one thing they do
 * that reads layout: `getBoundingClientRect` on the canvas, plus `offsetWidth`
 * and `offsetHeight` on every label. Doing that after the browser has already
 * started laying the page out forces it to finish synchronously, and on a
 * phone that lands in the middle of a scroll.
 *
 * What makes it land mid-scroll is the address bar. Scrolling down hides it,
 * scrolling up shows it, and each transition fires a resize that changes only
 * the viewport height, by roughly 60-110px depending on the browser. Nothing
 * about the page's layout has actually changed, so re-measuring is pure cost.
 *
 * So: a height-only change smaller than the tallest address bar is ignored
 * outright, and everything else is debounced and then run inside a frame, so a
 * drag-resize on a desktop measures once at the end rather than on every step.
 *
 * The drift is measured from the last size actually honoured, not the last
 * size seen, so ignoring small changes cannot accumulate into a missed real one.
 */

/** taller than any mobile address bar, shorter than a real layout change */
const ADDRESS_BAR_MAX = 120;

/** long enough to coalesce a desktop drag-resize, short enough not to be felt */
const DEBOUNCE_MS = 150;

export function onViewportChange(run: () => void): () => void {
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let timer = 0;
  let frame = 0;

  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // height-only, and small: the address bar, not a resize
    if (w === lastW && Math.abs(h - lastH) <= ADDRESS_BAR_MAX) return;
    lastW = w;
    lastH = h;

    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        run();
      });
    }, DEBOUNCE_MS);
  };

  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    window.removeEventListener("resize", onResize);
    clearTimeout(timer);
    if (frame) cancelAnimationFrame(frame);
  };
}
