import {
  ASPECT, ASSEMBLED_ANCHOR, DESKTOP_COUNT, EXPLODE_FRAMES, LAYER_GEOMETRY, MOBILE_COUNT,
  MOBILE_MAP,
} from "./burgerFrames";
import {
  FINALE_ANCHOR, FINALE_BACKDROP, FINALE_DESKTOP_COUNT, FINALE_MOBILE_COUNT,
} from "./finaleFrames";
import type { SequenceSource } from "./FrameSequence";

/**
 * The story, in "stops" — 0 to LAST_STOP, mapped linearly from scroll position.
 *
 * The beats are not evenly spaced and they are not continuous motion. Each one
 * moves, then *holds*: the burger arrives at a pose and sits there for a stretch
 * of scrolling before the next beat starts. Without those holds the sequence is
 * one unbroken slide from first frame to last, and at reading speed the eye
 * never gets a still picture to land on — which is what "it goes too fast, I
 * can't see what's happening" actually describes. The holds are the animation.
 *
 *   0     - 1.0   the burger comes apart
 *   1.0   - 1.35  HOLD, apart, all six ingredient labels readable
 *   1.35  - 2.2   it goes back together
 *   2.2   - 2.5   HOLD, whole again
 *   2.5   - 3.4   it settles into the box
 *   3.4   - 4     the menu wipe
 *
 * `.scroll-story` is 900svh over a 100svh stage, so a stop is two viewports of
 * scrolling. Change the two together: the schedule is in stops, the room it gets
 * is in CSS.
 */
export const STOPS = ["intro", "layers", "whole", "boxed", "menu"] as const;
export const LAST_STOP = STOPS.length - 1;

/** the beat boundaries above, in one place so they can be re-timed together */
const EXPLODE_END = 1.0;
const APART_HOLD_END = 1.35;
const REASSEMBLE_END = 2.2;
const WHOLE_HOLD_END = 2.5;
const BOX_END = 3.4;

export const BURGER_SEQUENCE: SequenceSource = {
  dir: "burger-seq",
  desktopCount: DESKTOP_COUNT,
  mobileCount: MOBILE_COUNT,
  mobileMap: MOBILE_MAP,
  // from the generated manifest, not a literal: the crop is the union of every
  // keyed frame, so it changes whenever the sequence is rebuilt
  aspect: ASPECT,
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
/** ease-in-out, so a beat decelerates into the hold that follows it */
const ease = (t: number) => t * t * (3 - 2 * t);
/** `span`, eased */
const beat = (v: number, from: number, to: number) => ease(span(v, from, to));

/** scroll fraction over the whole section -> position between stops, 0..LAST_STOP */
export function stopForProgress(p: number): number {
  return clamp01(p) * LAST_STOP;
}

/** apart, hold, back together — see the schedule above */
export function frameForStop(stop: number): number {
  if (stop <= 0) return 0;
  if (stop < EXPLODE_END) return lerp(0, LAST_EXPLODE, beat(stop, 0, EXPLODE_END));
  if (stop < APART_HOLD_END) return LAST_EXPLODE;
  if (stop < REASSEMBLE_END) {
    return lerp(EXPLODE_FRAMES, LAST_FRAME, beat(stop, APART_HOLD_END, REASSEMBLE_END));
  }
  return LAST_FRAME;
}

/** it settles into the box */
export function finaleFrameForStop(stop: number): number {
  return lerp(0, FINALE_DESKTOP_COUNT - 1, beat(stop, WHOLE_HOLD_END, BOX_END));
}

/**
 * How far the closing beat has taken the stage from the burger sequence, 0..1.
 *
 * A short cross-fade rather than a hard swap: the two sequences are lined up
 * geometrically but they are separate renders, so cutting between them shows the
 * seam. Over a tenth of a stop it reads as one continuous object.
 */
export function finaleTakeover(stop: number): number {
  return span(stop, WHOLE_HOLD_END, WHOLE_HOLD_END + 0.1);
}

/**
 * How far the backdrop has settled from the page's own gradient to the flat
 * studio colour the closing frames were shot on. Finishing before the takeover
 * is what hides the seam around those opaque frames.
 */
export function studioFade(stop: number): number {
  return span(stop, 1.95, WHOLE_HOLD_END - 0.08);
}

/**
 * The closing beat starts framed to match the burger it takes over from, then
 * settles into its own centred framing — the box is far wider than the burger.
 */
export function finaleSettle(stop: number): number {
  return beat(stop, WHOLE_HOLD_END, WHOLE_HOLD_END + 0.6);
}

/**
 * How large the burger is drawn, as the story opens it.
 *
 * The frames are cropped to the union of every pose, so the fully exploded
 * stack fills the frame and the assembled burger sits in the middle of it with
 * a screen of empty space above and below. Drawn at a fixed size that makes a
 * small hero. Instead the picture is scaled to fit the pose: large while the
 * burger is whole, easing back to 1 as the layers spread and need the room. It
 * reads as the camera pulling back to take the whole thing in, and it costs
 * nothing — the frames are drawn at the same resolution either way, and the
 * scale is a transform on the canvas rather than a change of layout.
 */
export function mediaScale(frame: number): number {
  const open = frame <= LAST_EXPLODE
    ? frame / LAST_EXPLODE
    : 1 - (frame - EXPLODE_FRAMES) / Math.max(1, LAST_FRAME - EXPLODE_FRAMES);
  return 1 + (MEDIA_SCALE - 1) * (1 - clamp01(open));
}

/** the headline clears out as the burger starts to come apart */
export function introFade(stop: number): number {
  return 1 - span(stop, 0.05, 0.55);
}

/** "Sloj po sloj." — up while the layers are apart, and through the hold */
export function layersTitle(stop: number): number {
  return Math.min(span(stop, 0.35, 0.8), 1 - span(stop, 1.45, 1.75));
}

/** "Sve na svom mjestu." — up across the second hold, and gone before the box */
export function wholeTitle(stop: number): number {
  return Math.min(span(stop, 1.98, 2.18), 1 - span(stop, 2.38, WHOLE_HOLD_END + 0.02));
}

/**
 * How strongly the ingredient labels are showing.
 *
 * They come in staggered while the burger opens, are fully up for the entire
 * apart-hold, and only start leaving once it begins closing again. Previously
 * they faded from stop 1.15 — before the burger had even finished opening — so
 * there was never a moment where all six could be read.
 */
export function labelReveal(stop: number, index: number): number {
  const inAt = 0.38 + index * 0.045;
  return Math.min(span(stop, inAt, inAt + 0.25), 1 - span(stop, 1.45, 1.75));
}

/** how far the red menu panel has risen */
export function menuWipe(stop: number): number {
  return span(stop, BOX_END + 0.05, LAST_STOP);
}

/** which of the four captions is showing, by beat rather than by rounding */
export function stepIndex(stop: number): number {
  if (stop < 0.5) return 0;                    // scroll to open
  if (stop < 1.45) return 1;                   // our ingredients
  if (stop < WHOLE_HOLD_END) return 2;         // assembling
  return 3;                                    // the menu is below
}

/**
 * Geometry that lines the closing sequence up with the burger it takes over
 * from. Both sequences report where the assembled burger sits inside their own
 * frame, so the closing frames can be scaled and offset to put their burger
 * exactly where the previous beat left one.
 */
const burgerH = ASSEMBLED_ANCHOR.bottom - ASSEMBLED_ANCHOR.top;
const finaleH = FINALE_ANCHOR.bottom - FINALE_ANCHOR.top;

/** how much of the burger element's height the assembled burger should fill */
const ASSEMBLED_FILL = 0.66;

/** what the picture is scaled by when the burger is whole — see mediaScale */
export const MEDIA_SCALE = ASSEMBLED_FILL / burgerH;

/**
 * closing element height, as a multiple of the burger element's height.
 *
 * Times MEDIA_SCALE, because the beat it takes over from is drawn scaled: the
 * two have to agree on the burger's size on screen, not in the frame.
 */
export const FINALE_SCALE = (burgerH / finaleH) * MEDIA_SCALE;

/**
 * Downward nudge for the closing element, as a multiple of the burger element's
 * height. Both elements are centred on the same point, but the burger sits at a
 * different height inside each frame, so one has to shift to match the other.
 */
export const FINALE_OFFSET =
  ((ASSEMBLED_ANCHOR.top + ASSEMBLED_ANCHOR.bottom) / 2 - 0.5) * MEDIA_SCALE
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

/**
 * Which phase the counter should read, 1-based.
 *
 * By beat boundary rather than `Math.round(stop)`: the beats are no longer
 * evenly spaced, so rounding would tick the counter over in the middle of a
 * hold instead of at the moment the picture changes.
 */
export function stopLabel(stop: number): number {
  if (stop < 0.5) return 1;
  if (stop < 1.45) return 2;
  if (stop < WHOLE_HOLD_END) return 3;
  if (stop < BOX_END + 0.05) return 4;
  return 5;
}
