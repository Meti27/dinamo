/**
 * Paints the burger sequence onto a canvas.
 *
 * Deliberately not a React component and not driven by state: the sequence is
 * scrubbed at display rate, and re-rendering React to move a number is the most
 * expensive thing a page like this can do. GSAP writes a frame position here and
 * this draws it.
 *
 * Nothing in `draw` reads layout. The canvas geometry is computed once in
 * `resize`, which is the only place that measures anything.
 */

export type Bitmaps = readonly (ImageBitmap | HTMLImageElement)[];

const sizeOf = (img: ImageBitmap | HTMLImageElement) => ({
  w: "naturalWidth" in img ? img.naturalWidth : img.width,
  h: "naturalHeight" in img ? img.naturalHeight : img.height,
});

export class FrameCanvas {
  private ctx: CanvasRenderingContext2D | null = null;
  private frames: Bitmaps = [];
  /** where the frame is drawn inside the canvas, in device pixels */
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private drawn = -1;

  constructor(private canvas: HTMLCanvasElement) {}

  setFrames(frames: Bitmaps) {
    this.frames = frames;
    this.drawn = -1;
  }

  /**
   * Size the backing store to the element and work out where the frame sits
   * inside it. The only layout read in the class, and it happens on resize.
   */
  resize() {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
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

  /**
   * Draw a fractional position in the sequence, blending the two frames it falls
   * between.
   *
   * Snapping to the nearest frame is what reads as stepping: thirty stills over
   * several screens of scrolling means each is held for many display frames.
   * Cross-dissolving the neighbours turns the same stills into continuous motion.
   *
   * It has to be a real linear dissolve, not just painting the second over the
   * first: these frames carry alpha, so source-over leaves the outgoing burger
   * fully opaque underneath and you see two burgers. Drawing A at 1-t and then
   * adding B at t with "lighter" gives A*(1-t) + B*t, alpha included.
   */
  draw(position: number) {
    const frames = this.frames;
    if (!frames.length) return;

    const pos = Math.max(0, Math.min(frames.length - 1, position));
    const lo = Math.floor(pos);
    const hi = Math.min(frames.length - 1, lo + 1);
    const t = pos - lo;

    // quantised so an unchanged blend does not repaint
    const signature = lo * 1000 + Math.round(t * 60);
    if (signature === this.drawn) return;
    this.drawn = signature;

    const ctx = this.ctx ?? (this.ctx = this.canvas.getContext("2d"));
    if (!ctx) return;

    const { x, y, w, h } = this.box;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const a = frames[lo];
    const b = frames[hi];
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
}
