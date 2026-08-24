import { DESKTOP_COUNT, EXPLODE_FRAMES, LAYER_GEOMETRY } from "./burgerFrames";

/**
 * Where each beat of the scroll story sits, as a fraction of the section's
 * scrollable height.
 *
 * The source footage holds still for long stretches at each end and in the
 * middle; those dead frames were dropped at export time, so the holds live
 * here instead and can be retimed without re-encoding anything.
 */
export const BEATS = {
  /** assembled, hero copy on screen */
  introEnd: 0.15,
  /** coming apart */
  explodeEnd: 0.46,
  /** held apart, ingredient labels readable */
  studyEnd: 0.66,
  /** going back together */
  assembleEnd: 0.87,
  /** assembled again, the menu wipe takes over */
} as const;

const LAST_EXPLODE = EXPLODE_FRAMES - 1;
const LAST_FRAME = DESKTOP_COUNT - 1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** story progress 0..1 -> position in the frame sequence, as a float */
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
  const inAt = 0.30 + index * 0.018;
  return Math.min(span(p, inAt, inAt + 0.1), 1 - span(p, BEATS.studyEnd - 0.03, BEATS.studyEnd + 0.05));
}

/** how far the red menu panel has risen over the story */
export function menuWipe(p: number): number {
  return span(p, BEATS.assembleEnd + 0.04, 1);
}
