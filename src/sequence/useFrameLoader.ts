import { useEffect, useState } from "react";

import type { Bitmaps } from "./FrameCanvas";

/**
 * Fetches and decodes a sequence's frames, frame 0 first.
 *
 * The order matters more than the concurrency. The old version asked for all
 * twenty frames at once behind six connections and reported nothing until every
 * one had decoded, and the page was held on a loader for that whole time — which
 * put the hero headline, the largest thing on the first screen, about two
 * seconds behind the first paint for no reason. Frame 0 is the only frame the
 * first screen actually shows.
 *
 * So: fetch frame 0, publish it, and only then queue the rest, in an idle
 * callback so the browser gets to paint first. Four lanes rather than six —
 * beyond about four in-flight requests a phone on mobile data gains nothing and
 * the decodes start competing with the scroll.
 *
 * `createImageBitmap` decodes off the main thread, so the page stays responsive
 * while the tail arrives. Progress is published every tenth frame instead of
 * every frame: twenty setStates during boot is twenty React renders of the whole
 * tree to move a progress bar.
 *
 * Shared by every scroll sequence on the page (the burger, the ice cream): the
 * only thing that differs between them is where their frames live and how many
 * there are, which is what `FrameSource` carries — see `sequences.ts`.
 */

export type FrameSource = {
  /** directory under /public holding {desktop,mobile}/f##.avif */
  dir: string;
  desktopCount: number;
  mobileCount: number;
};

/** the breakpoint that picks the image set; `deviceTier` uses the same one */
const MOBILE_QUERY = "(max-width: 700px)";

/** in-flight requests for the tail of the sequence */
const LANES = 4;

/** how many frames may decode between two published progress updates */
const PROGRESS_EVERY = 10;

/** long enough to let a paint happen, short enough not to stall a slow phone */
const IDLE_TIMEOUT_MS = 300;

export type LoadStatus =
  /** nothing decoded yet — there is nothing to draw */
  | "waiting"
  /** frame 0 is in: the sequence can be drawn, and the rest is still arriving */
  | "usable"
  /** every frame is decoded */
  | "ready"
  /** no AVIF or no createImageBitmap — the caller should show its stills */
  | "unsupported";

export type LoadState = {
  readonly status: LoadStatus;
  /**
   * The frame array, whose identity is stable for the life of one load: it is
   * filled in place as frames arrive, so a consumer can hold on to it and ask
   * `loaded` how much of it is real.
   */
  readonly frames: Bitmaps;
  readonly loaded: number;
  readonly total: number;
  readonly progress: number;
};

const NOTHING: LoadState = {
  status: "waiting", frames: [], loaded: 0, total: 0, progress: 0,
};
const UNSUPPORTED: LoadState = { ...NOTHING, status: "unsupported" };

async function fetchFrame(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

/** after the next paint, and definitely within IDLE_TIMEOUT_MS */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      setTimeout(resolve, 32);
    }
  });
}

export function useFrameLoader(enabled: boolean, source: FrameSource): LoadState {
  const [state, setState] = useState<LoadState>(NOTHING);

  useEffect(() => {
    if (!enabled) return;
    if (typeof createImageBitmap !== "function") {
      setState(UNSUPPORTED);
      return;
    }

    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const variant = mobile ? "mobile" : "desktop";
    const total = mobile ? source.mobileCount : source.desktopCount;
    const url = (i: number) =>
      `/${source.dir}/${variant}/f${String(i).padStart(2, "0")}.avif`;

    const frames: (ImageBitmap | undefined)[] = new Array(total);
    let cancelled = false;
    let loaded = 0;

    const publish = (status: LoadStatus) => {
      if (cancelled) return;
      setState({ status, frames, loaded, total, progress: total ? loaded / total : 1 });
    };

    (async () => {
      try {
        frames[0] = await fetchFrame(url(0));
        loaded = 1;
        publish(total <= 1 ? "ready" : "usable");

        // let the browser paint frame 0 and the hero before the tail is queued
        await whenIdle();
        if (cancelled) return;

        let cursor = 1;
        const worker = async () => {
          while (!cancelled) {
            const i = cursor++;
            if (i >= total) return;
            frames[i] = await fetchFrame(url(i));
            loaded++;
            if (loaded % PROGRESS_EVERY === 0) publish("usable");
          }
        };
        await Promise.all(Array.from({ length: LANES }, worker));
        publish("ready");
      } catch {
        // no AVIF support, or the files are missing — fall back to the stills
        if (!cancelled) setState(UNSUPPORTED);
      }
    })();

    return () => {
      cancelled = true;
      for (const f of frames) f?.close?.();
    };
  }, [enabled, source.dir, source.desktopCount, source.mobileCount]);

  return state;
}
