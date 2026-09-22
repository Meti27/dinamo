/**
 * Frame-time and long-task instrumentation, loaded only for `?debug`.
 *
 * It exists because "feels laggy" is not a measurement and the two things that
 * make this page feel laggy are measurable separately:
 *
 *  - frame times, which say whether the scrub is keeping up with the display
 *  - long tasks, which say whether something blocked the main thread long
 *    enough that input could not be handled at all
 *
 * A frame counter alone hides the second one: sixty frames in a second with one
 * 300ms stall in the middle still reports 60fps for that second. So both are
 * collected, and the summary reports the distribution rather than an average —
 * an average frame time is exactly the statistic a stutter disappears into.
 *
 * Lives in its own chunk behind a dynamic import, so nothing here is in the
 * bundle a normal visitor downloads.
 */

type Window_ = Window & { __perf?: Perf };

export type PerfSummary = {
  /** how long the window being summarised ran for, ms */
  elapsed: number;
  frames: number;
  fps: number;
  /** frame intervals, ms */
  p50: number;
  p95: number;
  worst: number;
  /** frames that missed a 60Hz deadline, and badly */
  over16: number;
  over33: number;
  /** PerformanceObserver 'longtask' entries */
  longTasks: number;
  longTaskMs: number;
  longestTask: number;
};

export type Perf = {
  reset(): void;
  summary(): PerfSummary;
  stop(): void;
};

const percentile = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

export function startPerfLogger(): Perf {
  const win = window as Window_;
  if (win.__perf) return win.__perf;

  let intervals: number[] = [];
  let tasks: number[] = [];
  let last = performance.now();
  let started = last;
  let raf = 0;
  let live = true;

  // one-second rolling report, so a scroll can be watched as it happens
  let windowStart = last;
  let windowFrames = 0;
  let windowWorst = 0;

  const tick = (now: number) => {
    if (!live) return;
    const dt = now - last;
    last = now;
    intervals.push(dt);
    windowFrames++;
    if (dt > windowWorst) windowWorst = dt;
    if (now - windowStart >= 1000) {
      const fps = (windowFrames * 1000) / (now - windowStart);
      // eslint-disable-next-line no-console
      console.log(`[perf] ${fps.toFixed(1)} fps, worst frame ${windowWorst.toFixed(1)}ms`);
      windowStart = now;
      windowFrames = 0;
      windowWorst = 0;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tasks.push(entry.duration);
        // eslint-disable-next-line no-console
        console.log(`[perf] long task ${entry.duration.toFixed(0)}ms`);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // no longtask support (Safari) — frame times still work
  }

  const perf: Perf = {
    reset() {
      intervals = [];
      tasks = [];
      started = performance.now();
      last = started;
      windowStart = started;
      windowFrames = 0;
      windowWorst = 0;
    },
    summary() {
      const elapsed = performance.now() - started;
      // the first interval spans the gap since reset, not a rendered frame
      const sample = intervals.slice(1);
      const sorted = [...sample].sort((a, b) => a - b);
      return {
        elapsed: Math.round(elapsed),
        frames: sample.length,
        fps: Number(((sample.length * 1000) / elapsed).toFixed(1)),
        p50: Number(percentile(sorted, 0.5).toFixed(1)),
        p95: Number(percentile(sorted, 0.95).toFixed(1)),
        worst: Number((sorted.length ? sorted[sorted.length - 1] : 0).toFixed(1)),
        over16: sample.filter((d) => d > 16.7).length,
        over33: sample.filter((d) => d > 33.4).length,
        longTasks: tasks.length,
        longTaskMs: Math.round(tasks.reduce((a, b) => a + b, 0)),
        longestTask: Math.round(tasks.reduce((a, b) => Math.max(a, b), 0)),
      };
    },
    stop() {
      live = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    },
  };

  win.__perf = perf;
  // eslint-disable-next-line no-console
  console.log("[perf] logging frame times and long tasks — window.__perf.summary()");
  return perf;
}
