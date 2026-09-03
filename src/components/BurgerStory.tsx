import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { FrameCanvas } from "../sequence/FrameCanvas";
import { useFrameLoader } from "../sequence/useFrameLoader";
import {
  ASPECT, DESKTOP_COUNT, LAYER_COUNT, LAYER_GEOMETRY, MOBILE_COUNT, MOBILE_MAP,
} from "../frames";
import type { Copy } from "../data/copy";

gsap.registerPlugin(ScrollTrigger);

/**
 * The beat schedule, as fractions of the pinned scroll.
 *
 * The footage only runs closed -> apart, so the way back is the same frames in
 * reverse; that is where "the burger goes back assembled" comes from without
 * needing a second sequence.
 *
 * The hold in the middle is the important part. A pose that never stops moving
 * cannot be read, and the whole point of the beat is to look at the ingredients.
 */
const OPEN_END = 0.4;
const HOLD_END = 0.6;

/** gap between the burger and a label, and how far a label slides in from */
const LABEL_GAP = 14;
const LABEL_SLIDE = 20;
const EDGE_PINNED = "(max-width: 640px)";

type Metrics = {
  stageW: number;
  boxW: number;
  boxH: number;
  boxX: number;
  boxY: number;
  edgePinned: boolean;
  labelW: number[];
  labelH: number[];
};

export default function BurgerStory({ copy }: { copy: Copy }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headlineRef = useRef<HTMLElement>(null);
  const headlineInnerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const load = useFrameLoader(!reduced,
    { dir: "frames", desktopCount: DESKTOP_COUNT, mobileCount: MOBILE_COUNT });
  const ready = load.status === "ready";

  const steps = [copy.scrollOpen, copy.ingredientsStep, copy.assembling, copy.menuBelow];
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!ready || reduced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;

    const frames = load.frames;
    const painter = new FrameCanvas(canvas);
    painter.setFrames(frames);

    // desktop-space frame index -> this variant's own index space
    const mobile = frames.length === MOBILE_MAP.length;
    const toLocal = (f: number) => (mobile ? (f / (LAYER_GEOMETRY.length - 1)) * (frames.length - 1) : f);

    /**
     * Everything the scrub needs to know about the page's geometry, measured on
     * resize and never while scrubbing. Reading `offsetWidth` after writing a
     * style forces the browser to lay the page out again, synchronously, and
     * doing that once per frame is what drops frames on a mid-range phone.
     */
    const m: Metrics = {
      stageW: 0, boxW: 0, boxH: 0, boxX: 0, boxY: 0,
      edgePinned: false, labelW: [], labelH: [],
    };

    const measure = () => {
      painter.resize();
      const rect = canvas.getBoundingClientRect();
      m.stageW = stage.offsetWidth;
      m.edgePinned = window.matchMedia(EDGE_PINNED).matches;
      // the drawn frame is contained and centred inside the canvas element
      const scale = Math.min(rect.width / ASPECT, rect.height);
      m.boxH = scale;
      m.boxW = scale * ASPECT;
      m.boxX = (rect.width - m.boxW) / 2;
      m.boxY = (rect.height - m.boxH) / 2;
      for (let i = 0; i < LAYER_COUNT; i++) {
        const node = labelRefs.current[i];
        m.labelW[i] = node?.offsetWidth ?? 0;
        m.labelH[i] = node?.offsetHeight ?? 0;
      }
    };
    measure();

    /** progress 0..1 -> position in the sequence, opening then holding then closing */
    const positionFor = (p: number) => {
      const last = LAYER_GEOMETRY.length - 1;
      if (p <= OPEN_END) return (p / OPEN_END) * last;
      if (p <= HOLD_END) return last;
      return (1 - (p - HOLD_END) / (1 - HOLD_END)) * last;
    };

    /** how strongly the labels are showing — up for the hold, and either side of it */
    const revealFor = (p: number, i: number) => {
      const stagger = i * 0.018;
      const inAt = OPEN_END - 0.16 + stagger;
      const outAt = HOLD_END + 0.06 + stagger;
      const rise = Math.min(1, Math.max(0, (p - inAt) / 0.12));
      const fall = Math.min(1, Math.max(0, (p - outAt) / 0.12));
      return rise * (1 - fall);
    };

    const apply = (p: number) => {
      const frame = positionFor(p);
      painter.draw(toLocal(frame));

      // one geometry table, interpolated, so labels glide while the image steps
      const lo = Math.max(0, Math.min(LAYER_GEOMETRY.length - 1, Math.floor(frame)));
      const hi = Math.min(LAYER_GEOMETRY.length - 1, lo + 1);
      const t = frame - lo;

      for (let i = 0; i < LAYER_COUNT; i++) {
        const node = labelRefs.current[i];
        if (!node) continue;
        const reveal = revealFor(p, i);
        node.style.opacity = String(reveal);
        if (reveal < 0.01) {
          node.style.visibility = "hidden";
          continue;
        }
        node.style.visibility = "visible";
        const a = LAYER_GEOMETRY[lo][i];
        const b = LAYER_GEOMETRY[hi][i];
        const cy = a[0] + (b[0] - a[0]) * t;
        const lx = a[1] + (b[1] - a[1]) * t;
        const rx = a[2] + (b[2] - a[2]) * t;

        const slide = (1 - reveal) * LABEL_SLIDE;
        const left = i % 2 === 0;
        const x = m.edgePinned
          ? (left ? LABEL_GAP : m.stageW - LABEL_GAP - m.labelW[i])
          : (left
            ? m.boxX + m.boxW * lx - LABEL_GAP - m.labelW[i] - slide
            : m.boxX + m.boxW * rx + LABEL_GAP + slide);
        const y = m.boxY + m.boxH * cy - m.labelH[i] / 2;
        node.style.transform = `translate3d(${x}px,${y}px,0)`;
      }

      if (progressRef.current) progressRef.current.style.transform = `scaleY(${p})`;

      // the caption changes by beat, so it is diffed rather than written every frame
      const step = p < OPEN_END - 0.16 ? 0 : p < HOLD_END + 0.06 ? 1 : p < 0.96 ? 2 : 3;
      if (step !== shownStep && stepRef.current) {
        stepRef.current.textContent = stepsRef.current[step];
        shownStep = step;
      }
    };

    let shownStep = -1;
    apply(0);

    /**
     * One timeline on the pinning trigger, and every tween declares both ends.
     *
     * Two separate tweens touching the same property is what broke scrolling
     * back up: the headline had a one-shot entrance animating opacity and y, and
     * a second scroll-driven tween animating the same two. Reversing the scrub
     * restored the values GSAP had recorded for the *entrance*, so the headline
     * came back at opacity 0 and never reappeared. A single timeline of `fromTo`
     * tweens has nothing to record and reverses exactly.
     *
     * The entrance is on a child element for the same reason — nothing else may
     * animate what the scrub owns.
     */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: stage,
        pinSpacing: false,
        // GSAP's scrub is already time-based and frame-rate independent. Do not
        // add a speed cap on top: capping is what makes the picture carry on
        // after the hand has stopped, which reads as lag rather than smoothness.
        scrub: 0.6,
        onUpdate: (self) => apply(self.progress),
        onRefresh: measure,
      },
    });

    tl.fromTo(headlineRef.current,
      { autoAlpha: 1, y: 0 },
      { autoAlpha: 0, y: -46, ease: "none", duration: OPEN_END * 0.6 }, 0);

    tl.fromTo(titleRef.current,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, ease: "none", duration: 0.14 }, OPEN_END - 0.14);

    tl.fromTo(titleRef.current,
      { autoAlpha: 1 },
      { autoAlpha: 0, ease: "none", duration: 0.1 }, HOLD_END);

    // pad the timeline to a total duration of 1 so the positions above read as
    // fractions of the pinned scroll rather than of whatever the tweens sum to
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

  /**
   * The entrance, on a child of the element the scrub owns.
   *
   * Kept off `.story-headline` deliberately: that element's opacity and y belong
   * to the scroll timeline, and a second tween on the same properties is exactly
   * what stopped the headline coming back when you scrolled up.
   */
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
      <section className="story story-static" id="top" ref={sectionRef}>
        <div className="story-stage">
          <header className="story-headline is-shown">
            <p className="eyebrow"><span /> {copy.open}</p>
            <h1>{copy.headline[0]}<br />{copy.headline[1]}</h1>
            <p className="lede">{copy.intro}</p>
          </header>
          <div className="story-stills">
            <picture>
              <source srcSet="/frames/still-closed.avif" type="image/avif" />
              <img src="/frames/still-closed.webp" alt={copy.burgerAria} />
            </picture>
            <picture>
              <source srcSet="/frames/still-apart.avif" type="image/avif" />
              <img src="/frames/still-apart.webp" alt="" />
            </picture>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="story" id="top" ref={sectionRef}>
      <div className="story-stage" ref={stageRef}>
        <div className="story-grid" aria-hidden="true" />
        <div className="story-halo" aria-hidden="true" />

        <header className="story-headline" ref={headlineRef}>
          <div ref={headlineInnerRef}>
            <p className="eyebrow"><span /> {copy.open}</p>
            <h1>{copy.headline[0]}<br />{copy.headline[1]}</h1>
            <p className="lede">{copy.intro}</p>
          </div>
        </header>

        <div className="story-title" ref={titleRef}>
          <p>{copy.nothingHidden}</p>
          <h2>{copy.layerByLayer}</h2>
        </div>

        <div className="story-burger">
          <canvas ref={canvasRef} role="img" aria-label={copy.burgerAria} />
          {copy.ingredientLabels.map((label, i) => (
            <div
              className={`label label-${i + 1}`}
              key={label[0]}
              ref={(node) => { labelRefs.current[i] = node; }}
            >
              <span>0{i + 1}</span>
              <strong>{label[0]}</strong>
              <p>{label[1]}</p>
            </div>
          ))}
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
        <p className="story-step" ref={stepRef}>{steps[0]}</p>
      </div>
    </section>
  );
}
