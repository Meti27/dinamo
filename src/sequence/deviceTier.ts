/**
 * How hard this device can be pushed.
 *
 * Everything expensive about the scroll sequence scales with the number of
 * pixels the canvas has to fill, so the ceiling on `devicePixelRatio` is the
 * one knob that changes the cost by a large factor.
 *
 * The cap is low because the *source* is small. The mobile frames are 360px
 * wide and the desktop frames 560px; on a 393px-wide phone a cap of 1.25 gives
 * a ~490px backing store, which is already more pixels than the frame has. Any
 * cap above that is spent upscaling a 360px image — pure fill cost for no
 * detail. That is what makes 1.25/1.5 free rather than a compromise: the
 * previous cap of 2 was interpolating 786px of canvas out of 360px of picture.
 *
 * The blend is quantised hard for the same reason it exists at all. A dissolve
 * that rounds to the step already on screen is not repainted, so `blendSteps`
 * is directly the ceiling on repaints between one pair of frames. Sixty was
 * finer than any eye can follow across a pair of frames that are 1/20th of a
 * sequence apart; eight is not distinguishable in motion and repaints at most
 * eight times instead of sixty.
 *
 * `crossfade` is off on mobile and under reduced motion: one `drawImage` per
 * integer frame index, no second draw and no `lighter` pass. That is the
 * cheapest the scrub can be, and it is a visible trade — twenty stills over
 * four viewports means each is held for many display frames, so the burger
 * steps rather than glides. Chosen deliberately; flip `crossfade` back to true
 * here to undo it.
 *
 * The viewport class is re-read on every call rather than frozen at import,
 * because a desktop window dragged narrow, or a phone rotated, crosses the
 * boundary — and `FrameCanvas.resize` asks again each time it re-measures.
 */

declare global {
  interface Navigator {
    /** Device Memory API — GiB of RAM, rounded down to a power of two. Not in lib.dom. */
    readonly deviceMemory?: number;
  }
}

/** the same breakpoint the frame loader picks its image set with */
const MOBILE_QUERY = "(max-width: 700px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** one MediaQueryList each, created once — matchMedia itself is not free */
const mobileMedia = typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY) : null;
const reducedMedia = typeof window !== "undefined" ? window.matchMedia(REDUCED_QUERY) : null;

/** true when the device looks like it will struggle: few cores or little RAM */
function detectLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;
  // both are absent on some browsers; assume a capable device rather than
  // punishing every Safari user for not shipping the Device Memory API
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  return cores <= 4 || memory <= 4;
}

export const lowEnd = detectLowEnd();

export type CanvasBudget = {
  /** ceiling for devicePixelRatio when sizing a canvas backing store */
  readonly dprCap: number;
  /** how finely a cross-dissolve is quantised before it stops repainting */
  readonly blendSteps: number;
  /** false: draw one frame per integer index, no second draw and no "lighter" */
  readonly crossfade: boolean;
};

export function canvasBudget(): CanvasBudget {
  const mobile = mobileMedia?.matches ?? false;
  const reduced = reducedMedia?.matches ?? false;
  return {
    dprCap: mobile ? (lowEnd ? 1 : 1.25) : lowEnd ? 1.25 : 1.5,
    blendSteps: 8,
    crossfade: !mobile && !reduced,
  };
}
