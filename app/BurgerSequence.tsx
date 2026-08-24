"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ASPECT, DESKTOP_COUNT, EXPLODE_FRAMES, MOBILE_COUNT, MOBILE_MAP } from "./burgerFrames";

/**
 * Scroll-scrubbed burger, drawn as a preloaded frame sequence on a canvas.
 *
 * Seeking a video (`video.currentTime = …`) forces the decoder back to the
 * previous keyframe on every scroll tick, which janks everywhere and does not
 * work at all on iOS Safari. Blitting an already-decoded frame costs nothing,
 * so the burger tracks the scrollbar exactly.
 */

type Props = {
  /** position in the sequence, as a float — only the rounded frame is drawn */
  frame: number;
  label: string;
};

const MOBILE_QUERY = "(max-width: 700px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** mobile ships fewer frames; map a desktop frame index onto the nearest one */
const MOBILE_INVERSE: number[] = Array.from({ length: DESKTOP_COUNT }, (_, d) => {
  let best = 0;
  for (let m = 1; m < MOBILE_MAP.length; m++) {
    if (Math.abs(MOBILE_MAP[m] - d) < Math.abs(MOBILE_MAP[best] - d)) best = m;
  }
  return best;
});

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

type Loaded = { images: (CanvasImageSource | undefined)[]; toIndex: (frame: number) => number };

async function fetchFrame(dir: string, i: number): Promise<CanvasImageSource> {
  const url = `/burger-seq/${dir}/f${String(i).padStart(3, "0")}.avif`;
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

export default function BurgerSequence({ frame, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef<Loaded | null>(null);
  const frameRef = useRef(frame);
  const drawnRef = useRef(-1);
  const rafRef = useRef(0);

  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const narrow = useMediaQuery(MOBILE_QUERY);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const still = reducedMotion || unsupported;

  const draw = () => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const loaded = loadedRef.current;
    if (!canvas || !loaded) return;

    const i = loaded.toIndex(frameRef.current);
    const img = loaded.images[i];
    if (!img || i === drawnRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    if (still) return;

    // Read the query here rather than trusting `narrow`: on hydration that
    // starts from the server snapshot (false) and only corrects on the next
    // render, which would kick off a desktop fetch on a phone. The store value
    // is still the dependency, so a real viewport change re-runs this.
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const dir = mobile ? "mobile" : "desktop";
    const count = mobile ? MOBILE_COUNT : DESKTOP_COUNT;
    const clampFrame = (f: number) => Math.max(0, Math.min(DESKTOP_COUNT - 1, Math.round(f)));
    const toIndex = mobile ? (f: number) => MOBILE_INVERSE[clampFrame(f)] : clampFrame;

    const images: (CanvasImageSource | undefined)[] = new Array(count);
    loadedRef.current = { images, toIndex };
    drawnRef.current = -1;
    let cancelled = false;

    // The burger has to come apart before it can go back together, so fetch the
    // explode frames first and pull the reassembly down in the background while
    // the visitor is still reading the ingredient labels.
    const split = mobile ? MOBILE_MAP.findIndex((d) => d >= EXPLODE_FRAMES) : EXPLODE_FRAMES;
    const firstPass = split > 0 ? split : count;

    // A frame that fails to load is left undefined; draw() skips it and holds
    // the previous one, which beats tearing down an otherwise working canvas.
    const loadRange = async (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        if (cancelled) return;
        try {
          images[i] = await fetchFrame(dir, i);
          schedule();
        } catch {
          /* keep going */
        }
      }
    };

    (async () => {
      try {
        // frame 0 is what the hero shows, so reveal as soon as it lands
        images[0] = await fetchFrame(dir, 0);
      } catch {
        // No AVIF support, or the files are missing — fall back to the still.
        if (!cancelled) setUnsupported(true);
        return;
      }
      if (cancelled) return;
      setReady(true);
      schedule();
      await loadRange(1, firstPass);
      if (cancelled) return;
      await loadRange(firstPass, count);
    })();

    return () => {
      cancelled = true;
      loadedRef.current = null;
      for (const img of images) {
        if (img && "close" in img) (img as ImageBitmap).close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow, still]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || still) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        drawnRef.current = -1;
        schedule();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  if (still) {
    return (
      <picture>
        <source srcSet="/burger-still.avif" type="image/avif" />
        <img className="burger-media" src="/burger-still.webp" alt={label} />
      </picture>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={ready ? "burger-media ready" : "burger-media"}
      style={{ aspectRatio: String(ASPECT) }}
      role="img"
      aria-label={label}
    />
  );
}
