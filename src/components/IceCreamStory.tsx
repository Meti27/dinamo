import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { FrameCanvas } from "../sequence/FrameCanvas";
import { useFrameLoader } from "../sequence/useFrameLoader";
import { ASPECT, DESKTOP_COUNT, MOBILE_COUNT } from "../iceFrames";
import type { Copy } from "../data/copy";

gsap.registerPlugin(ScrollTrigger);

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

export default function IceCreamStory({ copy }: { copy: Copy }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headlineRef = useRef<HTMLElement>(null);
  const headlineInnerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const load = useFrameLoader(!reduced,
    { dir: "icecream", desktopCount: DESKTOP_COUNT, mobileCount: MOBILE_COUNT });
  const ready = load.status === "ready";

  useEffect(() => {
    if (!ready || reduced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;

    const frames = load.frames;
    const painter = new FrameCanvas(canvas);
    painter.setFrames(frames);

    // desktop-space frame index -> this variant's own index space. Simpler than
    // the burger's version: there is no per-frame geometry table to borrow a
    // length from, so it maps against DESKTOP_COUNT directly.
    const mobile = frames.length !== DESKTOP_COUNT;
    const toLocal = (f: number) => (mobile ? (f / (DESKTOP_COUNT - 1)) * (frames.length - 1) : f);

    /** measured on resize, never inside the scrub — see BurgerStory for why */
    const m: Metrics = { boxW: 0, boxH: 0 };
    const measure = () => {
      painter.resize();
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / ASPECT, rect.height);
      m.boxH = scale;
      m.boxW = scale * ASPECT;
    };
    measure();

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

    /**
     * One timeline, every tween declares both ends — see BurgerStory's note on
     * why a second tween touching the same property is what breaks scrolling
     * back up: it stops GSAP being able to reverse the property exactly.
     */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: stage,
        pinSpacing: false,
        scrub: 0.6,
        onUpdate: (self) => apply(self.progress),
        onRefresh: measure,
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

    const onResize = () => {
      measure();
      apply(trigger.progress);
    };
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(onResize).catch(() => {});

    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }, [ready, reduced, load]);

  /** the entrance, on a child element — see BurgerStory for why not the parent */
  useEffect(() => {
    if (!ready || reduced) return;
    const inner = headlineInnerRef.current;
    if (!inner) return;
    const tween = gsap.fromTo(inner,
      { autoAlpha: 0, y: 22 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: "power2.out" });
    return () => { tween.kill(); gsap.set(inner, { clearProps: "all" }); };
  }, [ready, reduced]);

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
          <div ref={headlineInnerRef}>
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

        {load.status === "loading" && (
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
