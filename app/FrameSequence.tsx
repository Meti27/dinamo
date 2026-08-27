"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore,
} from "react";

/**
 * A scroll-scrubbed image sequence drawn onto a canvas.
 *
 * Seeking a video (`video.currentTime = …`) forces the decoder back to the
 * previous keyframe on every scroll tick, which janks everywhere and does not
 * work at all on iOS Safari. Blitting an already-decoded frame costs nothing,
 * so the picture tracks the scrollbar exactly — on a phone as much as a desktop.
 *
 * The frame is set imperatively rather than passed as a prop: the animation
 * runs at display rate, and re-rendering React sixty times a second to move a
 * number is the single most expensive thing a page like this can do.
 */

export type SequenceSource = {
  /** directory under /public holding `<dir>/{desktop,mobile}/f000.avif` */
  dir: string;
  desktopCount: number;
  mobileCount: number;
  /** width / height of every frame */
  aspect: number;
  /** frames below this index are fetched first, the rest stream in after */
  priorityUntil?: number;
  /**
   * mobile frame i is a copy of desktop frame mobileMap[i]. Needed when the two
   * variants are not sampled at a uniform ratio; omit for an even reduction.
   */
  mobileMap?: readonly number[];
  /**
   * Hold off this long before fetching, so a later beat yields the connection to
   * the one the visitor sees first. A plain delay rather than a scroll trigger:
   * scroll state is driven by requestAnimationFrame, which a background tab
   * throttles, and a sequence that never preloads is worse than one that
   * preloads early.
   */
  startDelayMs?: number;
};

export type FrameSequenceHandle = {
  /** position in the sequence, over the DESKTOP frame count; fractions blend */
  setFrame: (frame: number) => void;
};

type Props = {
  source: SequenceSource;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  /** still shown for reduced motion, or if the frames cannot be decoded */
  still: { avif: string; fallback: string };
};

const MOBILE_QUERY = "(max-width: 700px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // server render: assume the wide, motion-friendly case
  );
}

/**
 * The order frames are fetched in: a few coarse sweeps of the *whole* sequence
 * before any of them is filled in densely.
 *
 * Fetching 0,1,2,…,n in order means the end of the story has nothing to draw
 * until the beginning is completely finished — scroll down early and the burger
 * sits frozen on whichever frame it last managed to load, which is exactly what
 * "it skips" looks like. Sweeping at stride 8, then 4, then 2, then 1 makes the
 * entire story scrubbable after the first pass and only refines from there; the
 * cross-fade in `paint` already makes a coarse pass read as continuous motion.
 * Within each sweep the priority range goes first.
 */
function loadOrder(count: number, priority: number): number[] {
  const seen = new Uint8Array(count);
  const order: number[] = [];
  const push = (i: number) => {
    if (i < count && !seen[i]) { seen[i] = 1; order.push(i); }
  };
  seen[0] = 1; // already fetched on its own, to probe AVIF support
  for (let stride = 8; stride >= 1; stride >>= 1) {
    for (let i = 0; i < priority; i += stride) push(i);
    for (let i = 0; i < count; i += stride) push(i);
  }
  return order;
}

async function fetchFrame(url: string): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === "function") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return createImageBitmap(await res.blob());
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

const sizeOf = (img: CanvasImageSource, fallbackW: number, fallbackH: number) => ({
  w: "width" in img ? (img.width as number) : fallbackW,
  h: "height" in img ? (img.height as number) : fallbackH,
});

const FrameSequence = forwardRef<FrameSequenceHandle, Props>(function FrameSequence(
  { source, className, style, label, still }, ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<(CanvasImageSource | undefined)[] | null>(null);
  /** maps a desktop-space frame position onto this variant's own index space */
  const scaleRef = useRef<(f: number) => number>((f) => f);
  const countRef = useRef(0);
  const wantRef = useRef(0);
  const drawnRef = useRef(-1);

  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const narrow = useMediaQuery(MOBILE_QUERY);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const showStill = reducedMotion || unsupported;

  /**
   * Draw the frame, blending the two it falls between.
   *
   * Snapping to the nearest frame is what reads as "skipping": the sequence is
   * a few dozen stills spread over several screens of scrolling, so each one is
   * held for many display frames and the motion steps. Cross-dissolving the two
   * neighbours turns the same stills into continuous movement for free.
   *
   * It has to be a real linear dissolve, not just drawing the second on top:
   * these frames have alpha, and painting B over A leaves A's burger fully
   * opaque underneath, so you would see two burgers rather than one moving.
   * Drawing A at 1-t and adding B at t gives A*(1-t) + B*t, alpha included.
   */
  const paint = () => {
    const canvas = canvasRef.current;
    const images = imagesRef.current;
    if (!canvas || !images) return;

    const count = countRef.current;
    const pos = Math.max(0, Math.min(count - 1, scaleRef.current(wantRef.current)));
    const lo = Math.floor(pos);
    const hi = Math.min(count - 1, lo + 1);
    const t = pos - lo;

    let a = images[lo];
    let b: CanvasImageSource | undefined = images[hi];
    // quantised so an unchanged blend does not repaint
    let signature = lo * 1000 + Math.round(t * 60);

    if (!a) {
      // Still loading and this frame has not arrived. Draw the nearest one that
      // has, rather than holding whatever happened to be painted last: with the
      // sequence filling in coarse-to-fine the nearest is usually a frame or two
      // away, and showing it keeps the burger moving with the scroll instead of
      // freezing until the gap is filled.
      let near = -1;
      for (let d = 1; d < count; d++) {
        if (images[lo - d]) { near = lo - d; break; }
        if (images[lo + d]) { near = lo + d; break; }
      }
      if (near < 0) return;
      a = images[near];
      b = undefined;
      signature = -2 - near; // distinct from any real blend, and from the -1 reset
    }
    if (!a) return;

    if (signature === drawnRef.current) return;

    const { w, h } = sizeOf(a, canvas.width, canvas.height);
    if (canvas.width !== w || canvas.height !== h) {
      // Assigning width/height blanks the canvas, so it is sized from the frame
      // and never from the element — the closing beat animates its element size
      // every frame, and tracking that meant clearing on every one of them.
      canvas.width = w;
      canvas.height = h;
    }

    // fetched once and kept: getContext is cheap but not free, and this runs on
    // every display frame for the whole length of the story
    const ctx = ctxRef.current ?? (ctxRef.current = canvas.getContext("2d"));
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (!b || t < 0.002 || b === a) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(a, 0, 0, w, h);
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(a, 0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t;
      ctx.drawImage(b, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    drawnRef.current = signature;
  };

  useImperativeHandle(ref, () => ({
    setFrame: (frame: number) => {
      wantRef.current = frame;
      paint();
    },
  }));

  useEffect(() => {
    if (showStill) return;

    // Read the query here rather than trusting `narrow`: on hydration that
    // starts from the server snapshot (false) and only corrects on the next
    // render, which would kick off a desktop fetch on a phone. The store value
    // is still a dependency, so a real viewport change re-runs this.
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const dir = mobile ? "mobile" : "desktop";
    const count = mobile ? source.mobileCount : source.desktopCount;
    const span = Math.max(1, source.desktopCount - 1);

    countRef.current = count;
    const map = mobile ? source.mobileMap : undefined;
    if (map) {
      // the two variants are not sampled evenly, so interpolate the mapping
      // rather than rounding to the nearest listed frame
      scaleRef.current = (f: number) => {
        const clamped = Math.max(0, Math.min(span, f));
        let m = 0;
        while (m < map.length - 2 && map[m + 1] <= clamped) m++;
        const from = map[m];
        const to = map[m + 1] ?? from;
        return to === from ? m : m + (clamped - from) / (to - from);
      };
    } else {
      scaleRef.current = (f: number) => (f / span) * (count - 1);
    }

    const images: (CanvasImageSource | undefined)[] = new Array(count);
    imagesRef.current = images;
    drawnRef.current = -1;
    let cancelled = false;

    const priority = source.priorityUntil
      ? Math.max(1, Math.round((source.priorityUntil / source.desktopCount) * count))
      : count;

    // A frame that fails to load is left undefined; paint() holds the previous
    // one, which beats tearing down an otherwise working canvas.
    const order = loadOrder(count, priority);
    let cursor = 0;

    const worker = async () => {
      while (!cancelled) {
        const i = order[cursor++];
        if (i === undefined) return;
        try {
          images[i] = await fetchFrame(`/${source.dir}/${dir}/f${String(i).padStart(3, "0")}.avif`);
        } catch {
          continue; // keep going
        }
        // Only repaint if this is one of the two frames currently on screen.
        // With several fetches in flight the alternative is a repaint per
        // arrival, nearly all of them for frames nowhere near the scroll.
        const at = Math.floor(scaleRef.current(wantRef.current));
        if (i >= at - 1 && i <= at + 2) {
          drawnRef.current = -1;
          paint();
        }
      }
    };

    (async () => {
      if (source.startDelayMs) {
        await new Promise((r) => setTimeout(r, source.startDelayMs));
        if (cancelled) return;
      }
      try {
        images[0] = await fetchFrame(`/${source.dir}/${dir}/f000.avif`);
      } catch {
        // No AVIF support, or the files are missing — fall back to the still.
        if (!cancelled) setUnsupported(true);
        return;
      }
      if (cancelled) return;
      setReady(true);
      paint();
      // Several at a time rather than one after another. Serially, 56 frames is
      // 56 round trips end to end, and the tail of the story is unusable for
      // seconds; the sequence is over HTTP/2 to the same origin, so the requests
      // share one connection. Fewer in flight on a phone, where the decodes
      // compete for far less CPU.
      const lanes = mobile ? 3 : 6;
      await Promise.all(Array.from({ length: lanes }, worker));
    })();

    return () => {
      cancelled = true;
      imagesRef.current = null;
      for (const img of images) {
        if (img && "close" in img) (img as ImageBitmap).close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow, showStill, source.dir]);

  if (showStill) {
    return (
      <picture>
        <source srcSet={still.avif} type="image/avif" />
        <img className={className} style={style} src={still.fallback} alt={label ?? ""} />
      </picture>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={ready ? `${className ?? ""} ready`.trim() : className}
      style={{ ...style, aspectRatio: String(source.aspect) }}
      role={label ? "img" : "presentation"}
      aria-label={label}
    />
  );
});

export default FrameSequence;
