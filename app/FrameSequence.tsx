"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * A scroll-scrubbed image sequence drawn onto a canvas.
 *
 * Seeking a video (`video.currentTime = …`) forces the decoder back to the
 * previous keyframe on every scroll tick, which janks everywhere and does not
 * work at all on iOS Safari. Blitting an already-decoded frame costs nothing,
 * so the picture tracks the scrollbar exactly — on a phone as much as a desktop.
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

type Props = {
  source: SequenceSource;
  /** position in the sequence, as a float over the DESKTOP frame count */
  frame: number;
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

export default function FrameSequence({
  source, frame, className, style, label, still,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(CanvasImageSource | undefined)[] | null>(null);
  const toIndexRef = useRef<(f: number) => number>(() => 0);
  const frameRef = useRef(frame);
  const drawnRef = useRef(-1);
  const rafRef = useRef(0);

  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const narrow = useMediaQuery(MOBILE_QUERY);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const showStill = reducedMotion || unsupported;

  const draw = () => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const images = imagesRef.current;
    if (!canvas || !images) return;

    const i = toIndexRef.current(frameRef.current);
    const img = images[i];
    if (!img || i === drawnRef.current) return;

    // Size the backing store from the frame, never from the element. Assigning
    // canvas.width/height blanks the canvas, and the closing beat animates its
    // element size every scroll tick — tracking that meant clearing on each
    // tick and repainting a frame later, which reads as a flicker. CSS scales
    // the element instead; the frames are authored at display resolution.
    const w = "width" in img ? (img.width as number) : canvas.width;
    const h = "height" in img ? (img.height as number) : canvas.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    drawnRef.current = i;
  };

  const schedule = () => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  };

  // after every render, publish the requested frame and repaint if it moved
  useEffect(() => {
    frameRef.current = frame;
    schedule();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  });

  useEffect(() => {
    if (showStill) return;

    // Read the query here rather than trusting `narrow`: on hydration that
    // starts from the server snapshot (false) and only corrects on the next
    // render, which would kick off a desktop fetch on a phone. The store value
    // is still a dependency, so a real viewport change re-runs this.
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const dir = mobile ? "mobile" : "desktop";
    const count = mobile ? source.mobileCount : source.desktopCount;
    const span = source.desktopCount - 1;

    const map = mobile ? source.mobileMap : undefined;
    if (map) {
      const inverse = Array.from({ length: source.desktopCount }, (_, d) => {
        let best = 0;
        for (let m = 1; m < map.length; m++) {
          if (Math.abs(map[m] - d) < Math.abs(map[best] - d)) best = m;
        }
        return best;
      });
      toIndexRef.current = (f: number) =>
        inverse[Math.max(0, Math.min(source.desktopCount - 1, Math.round(f)))];
    } else {
      toIndexRef.current = (f: number) => {
        const t = span > 0 ? Math.max(0, Math.min(1, f / span)) : 0;
        return Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))));
      };
    }

    const images: (CanvasImageSource | undefined)[] = new Array(count);
    imagesRef.current = images;
    drawnRef.current = -1;
    let cancelled = false;

    const priority = source.priorityUntil
      ? Math.max(1, Math.round((source.priorityUntil / source.desktopCount) * count))
      : count;

    // A frame that fails to load is left undefined; draw() skips it and holds
    // the previous one, which beats tearing down an otherwise working canvas.
    const loadRange = async (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        if (cancelled) return;
        try {
          images[i] = await fetchFrame(`/${source.dir}/${dir}/f${String(i).padStart(3, "0")}.avif`);
          schedule();
        } catch {
          /* keep going */
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
      schedule();
      await loadRange(1, priority);
      if (cancelled) return;
      await loadRange(priority, count);
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
}
