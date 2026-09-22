import { useEffect, useRef } from "react";

import { FrameCanvas } from "../sequence/FrameCanvas";
import { loadScrollKit } from "../sequence/scrollConfig";
import { ICE_FRAMES } from "../sequence/sequences";
import { useFrameLoader } from "../sequence/useFrameLoader";
import { onViewportChange } from "../sequence/onViewportChange";
import { prefersReducedMotion } from "../sequence/prefersReducedMotion";
import { useNearViewport } from "../sequence/useNearViewport";
import { ASPECT, DESKTOP_COUNT } from "../iceFrames";
import type { Copy } from "../data/copy";

/**
 * Where the spin lands versus where it holds, as fractions of the pinned
 * scroll — the same beat shape as the burger story (open, then hold so the
 * closing text can be read), minus the layers this footage doesn't have.
 *
 * The turntable is a straight 30-frame sequence with nothing to reassemble, so
 * the whole scroll just scrubs through it once and holds on the last frame —
 * there is no reverse pass to build like the burger's explode/reassemble.
 */
const SPIN_END = 0.82;

type Metrics = {
  boxW: number;
  boxH: number;
};

/**
 * `booted` is the preloader having released the page. This sequence is below
 * the fold, so loading it while the burger is still decoding only takes
 * bandwidth and decode time away from the thing actually on screen.
 */
export default function IceCreamStory({ copy, booted }: { copy: Copy; booted: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headlineRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const painterRef = useRef<FrameCanvas | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);

  const reduced = prefersReducedMotion;

  /**
   * Two gates before a single byte of this sequence is fetched.
   *
   * `booted` is the preloader having released the page: until then the burger
   * frames are the only thing that matters, and competing with them for
   * bandwidth and decode time only delays the screen the visitor is looking at.
   *
   * `near` is this section coming within about a screen and a half. Loading
   * both sequences at once also meant holding both decoded at once, and an
   * ImageBitmap is uncompressed: twenty mobile frames of each is roughly 25MB
   * of RGBA resident, which is enough to cause collection pauses on a cheap
   * phone.
   */
  const near = useNearViewport(sectionRef, !reduced);
  const started = !reduced && booted && near;

  const load = useFrameLoader(started, ICE_FRAMES);
  const usable = load.status === "usable" || load.status === "ready";
  const frames = load.frames;

  useEffect(() => {
    if (!usable || reduced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;

    const painter = new FrameCanvas(canvas);
    painter.setFrames(frames, load.loaded);
    painterRef.current = painter;

    // desktop-space frame index -> this variant's own index space. Simpler than
    // the burger's version: there is no per-frame geometry table to borrow a
    // length from, so it maps against DESKTOP_COUNT directly.
    const mobile = frames.length !== DESKTOP_COUNT;
    const toLocal = (f: number) => (mobile ? (f / (DESKTOP_COUNT - 1)) * (frames.length - 1) : f);

    /** measured on resize, never inside the scrub — see BurgerStory for why */
    const m: Metrics = { boxW: 0, boxH: 0 };
    // the first measure is synchronous — apply(0) below needs the geometry now;
    // every later one is coalesced into a frame by the painter
    const measure = (immediate = false) => {
      if (immediate) painter.resizeNow(); else painter.resize();
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / ASPECT, rect.height);
      m.boxH = scale;
      m.boxW = scale * ASPECT;
    };
    measure(true);

    /** progress 0..SPIN_END -> frame 0..last, then held on the last frame */
    const positionFor = (p: number) => {
      const last = DESKTOP_COUNT - 1;
      if (p >= SPIN_END) return last;
      return Math.max(0, p / SPIN_END) * last;
    };

    const apply = (p: number) => {
      painter.draw(toLocal(positionFor(p)));
      if (progressRef.current) progressRef.current.style.transform = `scaleY(${p})`;
    };
    apply(0);

    let cancelled = false;
    let teardown = () => {};

    /**
     * GSAP arrives in its own chunk — see scrollConfig. This section is below
     * the fold and gated on `booted` besides, so it is always already there.
     *
     * One timeline, every tween declares both ends — see BurgerStory's note on
     * why a second tween touching the same property is what breaks scrolling
     * back up: it stops GSAP being able to reverse the property exactly.
     */
    void loadScrollKit().then(({ gsap }) => {
      if (cancelled) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: stage,
          pinSpacing: false,
          scrub: 0.6,
          onUpdate: (self) => apply(self.progress),
          onRefresh: () => measure(),
          // see BurgerStory: will-change only while the stage is actually moving
          onToggle: (self) => stage.classList.toggle("is-live", self.isActive),
        },
      });

      tl.fromTo(headlineRef.current,
        { autoAlpha: 1, y: 0 },
        { autoAlpha: 0, y: -46, ease: "none", duration: 0.3 }, 0);

      tl.fromTo(titleRef.current,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, ease: "none", duration: 0.14 }, SPIN_END - 0.14);

      tl.set({}, {}, 1);

      const trigger = tl.scrollTrigger!;
      redrawRef.current = () => apply(trigger.progress);

      const onResize = () => {
        measure();
        // after the painter's own coalesced resize, which was queued first
        requestAnimationFrame(() => apply(trigger.progress));
      };
      // not a raw resize listener: on a phone the address bar fires one on every
      // change of scroll direction, and measure() reads layout
      const stopWatchingViewport = onViewportChange(onResize);
      document.fonts?.ready.then(onResize).catch(() => {});

      teardown = () => {
        stopWatchingViewport();
        trigger.kill();
        redrawRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      teardown();
      painter.dispose();
      painterRef.current = null;
    };
    // `load.loaded` deliberately absent — see BurgerStory
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable, reduced, frames]);

  /** the tail of the sequence arriving: no new trigger, just a wider clamp */
  useEffect(() => {
    const painter = painterRef.current;
    if (!painter) return;
    painter.setAvailable(load.loaded);
    redrawRef.current?.();
  }, [load.loaded]);

  if (reduced || load.status === "unsupported") {
    return (
      <section className="story story-ice story-static">
        <div className="story-stage">
          <header className="story-headline is-shown">
            <p className="eyebrow"><span /> {copy.iceEyebrow}</p>
            <h1>{copy.iceHeadline[0]}<br />{copy.iceHeadline[1]}</h1>
            <p className="lede">{copy.iceIntro}</p>
          </header>
          <div className="story-stills">
            <picture>
              <source srcSet="/icecream/still-front.avif" type="image/avif" />
              <img src="/icecream/still-front.webp" alt={copy.iceAria} />
            </picture>
            <picture>
              <source srcSet="/icecream/still-back.avif" type="image/avif" />
              <img src="/icecream/still-back.webp" alt="" />
            </picture>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="story story-ice" ref={sectionRef}>
      <div className="story-stage" ref={stageRef}>
        <div className="story-grid" aria-hidden="true" />
        <div className="story-halo story-halo-ice" aria-hidden="true" />

        <header className="story-headline" ref={headlineRef}>
          <div className="story-intro">
            <p className="eyebrow"><span /> {copy.iceEyebrow}</p>
            <h1>{copy.iceHeadline[0]}<br />{copy.iceHeadline[1]}</h1>
            <p className="lede">{copy.iceIntro}</p>
          </div>
        </header>

        <div className="story-title" ref={titleRef}>
          <p>{copy.iceKicker}</p>
          <h2>{copy.iceTitle}</h2>
        </div>

        <div className="story-scoop">
          <canvas ref={canvasRef} role="img" aria-label={copy.iceAria} />
        </div>

        {started && load.status === "waiting" && (
          <div className="story-loading" role="status">
            <span className="story-loading-bar">
              <span style={{ transform: `scaleX(${load.progress})` }} />
            </span>
            <em>{copy.loading} {Math.round(load.progress * 100)}%</em>
          </div>
        )}

        <div className="story-rail" aria-hidden="true"><span ref={progressRef} /></div>
      </div>
    </section>
  );
}
