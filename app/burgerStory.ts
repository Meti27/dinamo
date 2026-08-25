import {
  ASSEMBLED_ANCHOR, DESKTOP_COUNT, EXPLODE_FRAMES, LAYER_GEOMETRY, MOBILE_COUNT, MOBILE_MAP,
} from "./burgerFrames";
import {
  FINALE_ANCHOR, FINALE_BACKDROP, FINALE_DESKTOP_COUNT, FINALE_MOBILE_COUNT,
} from "./finaleFrames";
import type { SequenceSource } from "./FrameSequence";

/**
 * The story is told in fixed stops rather than scrubbed continuously.
 *
 * One scroll gesture moves between neighbouring stops; the page snaps to them,
 * and the animation eases across on its own clock. Scrubbing straight from
 * scroll position tied every frame to however jerkily the wheel was turned,
 * which is what made it feel laggy — the scroll only chooses a destination now.
 *
 *   0  burger whole, headline on screen
 *   1  apart, ingredient labels readable
 *   2  back together
 *   3  boxed
 *   4  the menu wipe
 */
export const STOPS = ["intro", "layers", "whole", "boxed", "menu"] as const;
export const LAST_STOP = STOPS.length - 1;

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
/** how far `v` has travelled from `from` to `to`, clamped */
const span = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** scroll fraction over the whole section -> position between stops, 0..LAST_STOP */
export function stopForProgress(p: number): number {
  return clamp01(p) * LAST_STOP;
}

/** stop 0 -> 1: the burger comes apart */
export function frameForStop(stop: number): number {
  if (stop <= 0) return 0;
  if (stop < 1) return lerp(0, LAST_EXPLODE, span(stop, 0, 1));
  if (stop < 2) return lerp(EXPLODE_FRAMES, LAST_FRAME, span(stop, 1, 2));
  return LAST_FRAME;
}

/** stop 2 -> 3: it settles into the box */
export function finaleFrameForStop(stop: number): number {
  return lerp(0, FINALE_DESKTOP_COUNT - 1, span(stop, 2, 3));
}

/** 1 once the closing beat owns the stage */
export function finaleTakeover(stop: number): number {
  return stop >= 2 ? 1 : 0;
}

/**
 * How far the backdrop has settled from the page's own gradient to the flat
 * studio colour the closing frames were shot on. Finishing before stop 2 is
 * what hides the seam around those opaque frames.
 */
export function studioFade(stop: number): number {
  return span(stop, 1.55, 1.95);
}

/**
 * The closing beat starts framed to match the burger it takes over from, then
 * settles into its own centred framing — the box is far wider than the burger.
 */
export function finaleSettle(stop: number): number {
  const t = span(stop, 2, 2.7);
  return t * t * (3 - 2 * t); // smoothstep
}

/** the headline clears out as the burger starts to come apart */
export function introFade(stop: number): number {
  return 1 - span(stop, 0.05, 0.55);
}

/** "Sloj po sloj." — up while the layers are apart */
export function layersTitle(stop: number): number {
  return Math.min(span(stop, 0.35, 0.8), 1 - span(stop, 1.25, 1.6));
}

/** "Sve na svom mjestu." — up once it is whole again */
export function wholeTitle(stop: number): number {
  return Math.min(span(stop, 1.5, 1.85), 1 - span(stop, 2.15, 2.45));
}

/** how strongly the ingredient labels are showing */
export function labelReveal(stop: number, index: number): number {
  // staggered, but all six are fully up by the time the stop is reached
  const inAt = 0.38 + index * 0.045;
  return Math.min(span(stop, inAt, inAt + 0.25), 1 - span(stop, 1.15, 1.45));
}

/** how far the red menu panel has risen */
export function menuWipe(stop: number): number {
  return span(stop, 3.15, 4);
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

/** which stop the phase counter should read, 1-based */
export function stopLabel(stop: number): number {
  return Math.min(LAST_STOP, Math.round(stop)) + 1;
}
