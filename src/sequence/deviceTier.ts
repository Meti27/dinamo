/**
 * How hard this device can be pushed, decided once.
 *
 * Everything expensive about the scroll sequence scales with the number of
 * pixels the canvas has to fill: `FrameCanvas` clears the backing store and
 * draws the frame twice per tick to cross-dissolve, so the cost per scrub frame
 * is roughly `width * height * dpr^2 * 2`. Capping the device pixel ratio is
 * therefore the only knob that changes the cost by a large factor without
 * changing what the animation looks like.
 *
 * The previous cap was 2.5, which on a DPR-3 phone means a 975x2110 backing
 * store on a 390x844 viewport — over two million pixels, twice, every frame.
 * Capping at 2 costs nothing visible at these sizes and removes a third of the
 * fill; 1.5 on a weak device removes nearly two thirds.
 *
 * The dissolve itself stays on at every tier. Dropping it would be cheaper
 * still, but twenty stills without it read as stepping rather than motion, and
 * that is the thing the sequence exists to avoid.
 */

declare global {
  interface Navigator {
    /** Device Memory API — GiB of RAM, rounded down to a power of two. Not in lib.dom. */
    readonly deviceMemory?: number;
  }
}

export type DeviceTier = {
  /** true when the device looks like it will struggle: few cores or little RAM */
  readonly lowEnd: boolean;
  /** ceiling for devicePixelRatio when sizing a canvas backing store */
  readonly dprCap: number;
  /**
   * How finely a cross-dissolve between two frames is quantised. A blend that
   * rounds to the same step as the one already on screen is not repainted, so
   * this is directly the ceiling on repaints per pair of frames.
   */
  readonly blendSteps: number;
};

function detect(): DeviceTier {
  if (typeof navigator === "undefined") {
    return { lowEnd: false, dprCap: 2, blendSteps: 60 };
  }
  // both are absent on some browsers; assume a capable device rather than
  // punishing every Safari user for not shipping the Device Memory API
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  const lowEnd = cores <= 4 || memory <= 4;
  return {
    lowEnd,
    dprCap: lowEnd ? 1.5 : 2,
    blendSteps: lowEnd ? 20 : 60,
  };
}

export const deviceTier: DeviceTier = Object.freeze(detect());
