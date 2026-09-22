/**
 * Paints a scroll sequence onto a canvas.
 *
 * Deliberately not a React component and not driven by state: the sequence is
 * scrubbed at display rate, and re-rendering React to move a number is the most
 * expensive thing a page like this can do. GSAP writes a frame position here and
 * this draws it.
 *
 * Nothing in `draw` reads layout. The canvas geometry is computed once in
 * `resize`, which is the only place that measures anything.
 */

import { canvasBudget, type CanvasBudget } from "./deviceTier";

export type Bitmaps = readonly (ImageBitmap | HTMLImageElement | undefined)[];

/**
 * Overrides for the detected budget. Options only so a test can pin them —
 * normal callers let `canvasBudget()` decide per device and viewport.
 */
export type FrameCanvasOptions = Partial<CanvasBudget>;

const sizeOf = (img: ImageBitmap | HTMLImageElement) => ({
  w: "naturalWidth" in img ? img.naturalWidth : img.width,
  h: "naturalHeight" in img ? img.naturalHeight : img.height,
});

export class FrameCanvas {
  private ctx: CanvasRenderingContext2D | null = null;
  private frames: Bitmaps = [];
  /** how many leading frames have actually decoded — see `setAvailable` */
  private available = 0;
  /** where the frame is drawn inside the canvas, in device pixels */
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private drawn = -1;
  private budget: CanvasBudget;
  private resizeFrame = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly overrides: FrameCanvasOptions = {},
  ) {
    this.budget = { ...canvasBudget(), ...overrides };
  }

  setFrames(frames: Bitmaps, available = frames.length) {
    this.frames = frames;
    this.available = available;
    this.drawn = -1;
  }

  /**
   * How many frames from the start are decoded and safe to draw.
   *
   * Frames now arrive progressively — frame 0 is drawn before the rest are even
   * requested — so a scrub can ask for a position past the end of what exists.
   * Clamping to what has arrived shows the last real frame instead of a hole,
   * and the clamp lifts itself as the load catches up.
   */
  setAvailable(count: number) {
    if (count === this.available) return;
    this.available = count;
    this.drawn = -1; // a clamped position may now resolve to a different frame
  }

  /**
   * Size the backing store to the element and work out where the frame sits
   * inside it. The only layout read in the class.
   *
   * Coalesced into the next frame: a resize can arrive in a burst (an address
   * bar, a drag-resize, an orientation change that fires twice) and this reads
   * `getBoundingClientRect`, which forces layout. `resizeNow` is the
   * synchronous version, for the one case that cannot wait — the first measure,
   * where there is nothing on screen yet to keep steady.
   */
  resize(): void {
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.resizeNow();
    });
  }

  resizeNow(): void {
    // the viewport class can have changed since the last measure (rotation, or
    // a desktop window dragged past the breakpoint), and it decides the cap
    this.budget = { ...canvasBudget(), ...this.overrides };

    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.budget.dprCap);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.ctx = null; // a resized canvas loses its state
    }

    const first = this.frames[0];
    if (!first) return;
    const { w: fw, h: fh } = sizeOf(first);
    // contain, not cover: the whole burger is always visible and always centred,
    // which is what keeps it right on a tall phone as well as a wide desktop
    const scale = Math.min(w / fw, h / fh);
    this.box = {
      w: fw * scale,
      h: fh * scale,
      x: (w - fw * scale) / 2,
      y: (h - fh * scale) / 2,
    };
    this.drawn = -1;
  }

  /** drop the pending resize — nothing else here outlives its canvas */
  dispose() {
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = 0;
  }

  /**
   * Draw a fractional position in the sequence.
   *
   * Two modes, chosen by the budget:
   *
   * `crossfade` on (desktop) blends the two frames the position falls between.
   * Snapping to the nearest frame is what reads as stepping: thirty stills over
   * several screens of scrolling means each is held for many display frames, and
   * cross-dissolving the neighbours turns the same stills into continuous
   * motion. It has to be a real linear dissolve, not just painting the second
   * over the first: these frames carry alpha, so source-over leaves the outgoing
   * burger fully opaque underneath and you see two burgers. Drawing A at 1-t and
   * then adding B at t with "lighter" gives A*(1-t) + B*t, alpha included.
   *
   * `crossfade` off (mobile, reduced motion) draws one frame per integer index:
   * half the fill, no compositing mode changes, and a repaint only when the
   * index itself changes, which over a whole scroll is once per frame in the set.
   */
  draw(position: number) {
    const frames = this.frames;
    const last = Math.min(frames.length, this.available) - 1;
    if (last < 0) return;

    // Nothing is visible in a hidden tab, so painting into it is pure cost.
    // rAF is already paused there, but ScrollTrigger's own scroll handler is
    // not, and a programmatic scroll (an anchor, a restored position) still
    // reaches here. Marking the canvas dirty means the next real draw repaints
    // rather than deduplicating against a frame that was never painted.
    if (document.hidden) {
      this.drawn = -1;
      return;
    }

    const pos = Math.max(0, Math.min(last, position));

    if (!this.budget.crossfade) {
      const index = Math.round(pos);
      if (index === this.drawn) return;
      const frame = frames[index];
      if (!frame) return;
      this.drawn = index;
      const ctx = this.context();
      if (!ctx) return;
      const { x, y, w, h } = this.box;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(frame, x, y, w, h);
      return;
    }

    const lo = Math.floor(pos);
    const hi = Math.min(last, lo + 1);
    const t = pos - lo;

    // quantised so an unchanged blend does not repaint
    const signature = lo * 1000 + Math.round(t * this.budget.blendSteps);
    if (signature === this.drawn) return;
    this.drawn = signature;

    const ctx = this.context();
    if (!ctx) return;

    const { x, y, w, h } = this.box;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const a = frames[lo];
    const b = frames[hi];
    if (!a) return;
    if (!b || b === a || t < 0.002) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(a, x, y, w, h);
      return;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(a, x, y, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = t;
    ctx.drawImage(b, x, y, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  /**
   * The context, fetched once per backing store.
   *
   * `desynchronized` lets the compositor take the canvas without waiting for the
   * rest of the frame, which is exactly the right trade for a scrubbed image —
   * a frame of latency is invisible, a blocked frame is not.
   *
   * `alpha` stays *on*, deliberately. The frames are matted with transparency
   * around the food and the stage behind the canvas is a radial gradient with a
   * halo and a grid in it; an opaque context would paint black over all of that.
   * It is also what makes the dissolve above need "lighter" in the first place.
   */
  private context(): CanvasRenderingContext2D | null {
    return this.ctx ?? (this.ctx = this.canvas.getContext("2d", { desynchronized: true }));
  }
}
