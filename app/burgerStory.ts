import {
  ASSEMBLED_ANCHOR, DESKTOP_COUNT, EXPLODE_FRAMES, LAYER_GEOMETRY, MOBILE_COUNT, MOBILE_MAP,
} from "./burgerFrames";
import {
  FINALE_ANCHOR, FINALE_BACKDROP, FINALE_DESKTOP_COUNT, FINALE_MOBILE_COUNT,
} from "./finaleFrames";
import type { SequenceSource } from "./FrameSequence";

/**
 * Where each beat of the scroll story sits, as a fraction of the section's
 * scrollable height.
 *
 * Both source clips hold still for long stretches; those dead frames were
 * dropped at export time, so the holds live here instead and the whole story
 * can be retimed without re-encoding anything.
 */
export const BEATS = {
  /** assembled, hero copy on screen */
  introEnd: 0.13,
  /** coming apart */
  explodeEnd: 0.40,
  /** held apart, ingredient labels readable */
  studyEnd: 0.58,
  /** going back together */
  assembleEnd: 0.72,
  /** settling into the box, lid closing */
  boxingEnd: 0.93,
  /** the menu wipe takes over */
} as const;

export const BURGER_SEQUENCE: SequenceSource = {
  dir: "burger-seq",
  desktopCount: DESKTOP_COUNT,
  mobileCount: MOBILE_COUNT,
  mobileMap: MOBILE_MAP,
  aspect: 0.61158,
  priorityUntil: EXPLODE_FRAMES,
};

export const FINALE_SEQUENCE: SequenceSource = {
  dir: "finale-seq",
  desktopCount: FINALE_DESKTOP_COUNT,
  mobileCount: FINALE_MOBILE_COUNT,
  aspect: 1,
  // let the burger's opening frames claim the connection first
  startDelayMs: 1200,
};

export { FINALE_BACKDROP };

const LAST_EXPLODE = EXPLODE_FRAMES - 1;
const LAST_FRAME = DESKTOP_COUNT - 1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** story progress 0..1 -> position in the burger sequence, as a float */
export function frameForProgress(p: number): number {
  if (p <= BEATS.introEnd) return 0;
  if (p < BEATS.explodeEnd) {
    return lerp(0, LAST_EXPLODE, span(p, BEATS.introEnd, BEATS.explodeEnd));
  }
  if (p < BEATS.studyEnd) return LAST_EXPLODE;
  if (p < BEATS.assembleEnd) {
    return lerp(EXPLODE_FRAMES, LAST_FRAME, span(p, BEATS.studyEnd, BEATS.assembleEnd));
  }
  return LAST_FRAME;
}

/** story progress 0..1 -> position in the closing sequence, as a float */
export function finaleFrameForProgress(p: number): number {
  return lerp(0, FINALE_DESKTOP_COUNT - 1, span(p, BEATS.assembleEnd, BEATS.boxingEnd));
}

/**
 * How far the closing beat has settled from the framing it inherits (matched to
 * the burger it takes over from) into its own hero framing (centred and sized to
 * the viewport). The box is much wider than the burger, so without this the
 * finished box overruns the screen and sits off to one side.
 */
export function finaleSettle(p: number): number {
  const t = span(p, BEATS.assembleEnd, BEATS.assembleEnd + (BEATS.boxingEnd - BEATS.assembleEnd) * 0.65);
  return t * t * (3 - 2 * t); // smoothstep
}

/** 0 while the burger beat owns the stage, 1 once the closing beat does */
export function finaleTakeover(p: number): number {
  return p >= BEATS.assembleEnd ? 1 : 0;
}

/**
 * How far the backdrop has settled from the page's own gradient to the flat
 * studio colour the closing frames were shot on. Completing this before the
 * handoff is what hides the seam around those opaque frames.
 */
export function studioFade(p: number): number {
  return span(p, BEATS.assembleEnd - 0.14, BEATS.assembleEnd - 0.01);
}

/**
 * Geometry that lines the closing sequence up with the burger it takes over
 * from. Both sequences report where the assembled burger sits inside their own
 * frame, so the closing frames can be scaled and offset to put their burger
 * exactly where the previous beat left one.
 */
const burgerH = ASSEMBLED_ANCHOR.bottom - ASSEMBLED_ANCHOR.top;
const finaleH = FINALE_ANCHOR.bottom - FINALE_ANCHOR.top;

/** closing element height, as a multiple of the burger element's height */
export const FINALE_SCALE = burgerH / finaleH;

/**
 * Downward nudge for the closing element, as a multiple of the burger element's
 * height. Both elements are centred on the same point, but the burger sits at a
 * different height inside each frame, so one has to shift to match the other.
 */
export const FINALE_OFFSET =
  ((ASSEMBLED_ANCHOR.top + ASSEMBLED_ANCHOR.bottom) / 2 - 0.5)
  + (0.5 - (FINALE_ANCHOR.top + FINALE_ANCHOR.bottom) / 2) * FINALE_SCALE;

/** where a label should sit, as fractions of the burger's box */
export type LayerAnchor = { top: number; left: number; right: number };

/**
 * Position of one ingredient layer within the burger's box, interpolated
 * between frames so a label glides even though the image itself steps.
 */
export function layerAnchor(frame: number, layer: number): LayerAnchor {
  const lo = Math.max(0, Math.min(LAST_FRAME, Math.floor(frame)));
  const hi = Math.min(LAST_FRAME, lo + 1);
  const a = LAYER_GEOMETRY[lo][layer];
  const b = LAYER_GEOMETRY[hi][layer];
  const t = frame - lo;
  return { top: lerp(a[0], b[0], t), left: lerp(a[1], b[1], t), right: lerp(a[2], b[2], t) };
}

/** how strongly the ingredient labels are showing at this point in the story */
export function labelReveal(p: number, index: number): number {
  const inAt = 0.26 + index * 0.016;
  return Math.min(span(p, inAt, inAt + 0.09), 1 - span(p, BEATS.studyEnd - 0.03, BEATS.studyEnd + 0.04));
}

/** how far the red menu panel has risen over the story */
export function menuWipe(p: number): number {
  return span(p, BEATS.boxingEnd + 0.01, 1);
}
