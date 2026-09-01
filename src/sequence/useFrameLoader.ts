import { useEffect, useState } from "react";

import { DESKTOP_COUNT, MOBILE_COUNT } from "../frames";

/**
 * Fetches and decodes every frame before the animation is allowed to start.
 *
 * The brief is explicit that nothing should ever be seen half-loaded, and at
 * ~620 KB for the whole desktop set that is affordable — so this is a plain
 * preload rather than the progressive streaming a larger sequence would need.
 * A bounded pool keeps it to a handful of connections; `createImageBitmap`
 * decodes off the main thread so the page stays responsive while it runs.
 */

const MOBILE_QUERY = "(max-width: 700px)";
const LANES = 6;

export type LoadState =
  | { status: "loading"; progress: number }
  | { status: "ready"; frames: readonly ImageBitmap[] }
  | { status: "unsupported" };

async function fetchFrame(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

export function useFrameLoader(enabled: boolean): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading", progress: 0 });

  useEffect(() => {
    if (!enabled) return;
    if (typeof createImageBitmap !== "function") {
      setState({ status: "unsupported" });
      return;
    }

    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const dir = mobile ? "mobile" : "desktop";
    const count = mobile ? MOBILE_COUNT : DESKTOP_COUNT;

    const frames: ImageBitmap[] = new Array(count);
    let cancelled = false;
    let done = 0;
    let cursor = 0;

    const worker = async () => {
      while (!cancelled) {
        const i = cursor++;
        if (i >= count) return;
        frames[i] = await fetchFrame(`/frames/${dir}/f${String(i).padStart(2, "0")}.avif`);
        done++;
        if (!cancelled) setState({ status: "loading", progress: done / count });
      }
    };

    (async () => {
      try {
        await Promise.all(Array.from({ length: LANES }, worker));
        if (!cancelled) setState({ status: "ready", frames });
      } catch {
        // no AVIF support, or the files are missing — fall back to the stills
        if (!cancelled) setState({ status: "unsupported" });
      }
    })();

    return () => {
      cancelled = true;
      for (const f of frames) f?.close?.();
    };
  }, [enabled]);

  return state;
}
