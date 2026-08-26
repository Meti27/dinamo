"use client";

import { useEffect, useRef } from "react";

import FrameSequence, { type FrameSequenceHandle } from "./FrameSequence";
import {
  BURGER_SEQUENCE, FINALE_BACKDROP, FINALE_OFFSET, FINALE_SCALE, FINALE_SEQUENCE, LAST_STOP,
  finaleFrameForStop, finaleSettle, finaleTakeover, frameForStop, introFade, labelReveal,
  layerAnchor, layersTitle, menuWipe, stopForProgress, stopLabel, studioFade, wholeTitle,
} from "./burgerStory";

/**
 * How quickly the animation closes the gap to wherever the scroll is, per
 * second. Higher feels more directly attached to the wheel, lower floatier.
 */
const FOLLOW_RATE = 12;

/**
 * The speed limit, in stops per second. Scroll as hard as you like — the story
 * will not advance faster than this, it just keeps playing until it catches up.
 */
const MAX_STOPS_PER_SEC = 2.4;

type Copy = {
  open: string;
  headline: readonly string[];
  intro: string;
  nothingHidden: string;
  layerByLayer: string;
  simple: string;
  inPlace: string;
  scrollOpen: string;
  ingredientsStep: string;
  assembling: string;
  menuBelow: string;
  menu: string;
  burgerAria: string;
  boxAria: string;
  ingredientLabels: readonly (readonly string[])[];
};

/**
 * The story stage.
 *
 * Nothing here is React state. The animation runs at display rate, and putting
 * it through a render — even one scoped to this component — means reconciling
 * twenty-odd elements sixty times a second, which is what a mid-range phone
 * cannot keep up with. The loop writes to the DOM directly instead; React only
 * builds the structure and swaps the copy when the language changes.
 */
export default function ScrollStory({ copy }: { copy: Copy }) {
  const storyRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const layersTitleRef = useRef<HTMLDivElement>(null);
  const wholeTitleRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const wipeWordRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLElement>(null);
  const stepRef = useRef<HTMLParagraphElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const burgerSeq = useRef<FrameSequenceHandle>(null);
  const finaleSeq = useRef<FrameSequenceHandle>(null);

  const copyRef = useRef(copy);
  const shownRef = useRef(0);
  const applyRef = useRef<((stop: number) => void) | null>(null);
  const captionRef = useRef({ phase: -1, step: "" });

  // copy only changes when the language is switched; re-apply so the captions
  // pick it up without waiting for the next scroll
  useEffect(() => {
    copyRef.current = copy;
    captionRef.current = { phase: -1, step: "" };
    applyRef.current?.(shownRef.current);
  }, [copy]);

  useEffect(() => {
    const section = storyRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;

    let target = 0;
    let shown = -1;
    let raf = 0;
    let last = 0;

    /**
     * Height of one stage, not `window.innerHeight`.
     *
     * The section is sized in `svh`, which is stable, while `innerHeight` grows
     * as a phone's URL bar collapses. Mixing them made the denominator move
     * mid-scroll, so progress jumped — visible as a stutter on mobile and
     * nowhere else.
     */
    const stageHeight = () => sticky.offsetHeight || window.innerHeight;

    const apply = (stop: number) => {
      const c = copyRef.current;
      const frame = frameForStop(stop);
      const studio = studioFade(stop);
      const boxed = finaleTakeover(stop);
      const settle = finaleSettle(stop);
      const wipe = menuWipe(stop);
      const veil = 1 - studio;

      burgerSeq.current?.setFrame(frame);
      finaleSeq.current?.setFrame(finaleFrameForStop(stop));

      if (studioRef.current) studioRef.current.style.opacity = String(studio);
      if (gridRef.current) gridRef.current.style.opacity = String(veil);
      if (haloRef.current) haloRef.current.style.opacity = String(veil);

      if (introRef.current) {
        const o = introFade(stop);
        introRef.current.style.opacity = String(o);
        introRef.current.style.transform = `translateY(${Math.min(stop, 1) * -70}px)`;
        introRef.current.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      if (layersTitleRef.current) layersTitleRef.current.style.opacity = String(layersTitle(stop));
      if (wholeTitleRef.current) wholeTitleRef.current.style.opacity = String(wholeTitle(stop));

      if (burgerRef.current) burgerRef.current.style.opacity = boxed ? "0" : "1";
      if (groundRef.current) groundRef.current.style.opacity = boxed ? "0" : String(veil);

      // The closing beat starts framed to match the burger it takes over from,
      // then settles into its own. The frame is square, so on a phone the width
      // bound matters as much as the height one.
      const el = finaleRef.current;
      if (el) {
        const stageH = stageHeight();
        const burgerH = burgerRef.current?.offsetHeight ?? 0;
        const mix = (a: number, b: number) => a + (b - a) * settle;
        const h = mix(
          burgerH * FINALE_SCALE,
          Math.min(stageH * 0.84, window.innerWidth * 0.94, 760),
        );
        el.style.opacity = String(boxed);
        el.style.visibility = boxed ? "visible" : "hidden";
        el.style.left = `${mix(54, 50)}%`;
        el.style.height = `${h}px`;
        el.style.transform =
          `translate(-50%, -50%) translateY(${mix(FINALE_OFFSET * burgerH, 0)}px)`;
      }

      // Labels carry five properties each; skip the geometry while they are
      // invisible, which is most of the story.
      for (let i = 0; i < labelRefs.current.length; i++) {
        const node = labelRefs.current[i];
        if (!node) continue;
        const reveal = labelReveal(stop, i);
        node.style.opacity = String(reveal);
        if (reveal < 0.01) {
          node.style.visibility = "hidden";
          continue;
        }
        node.style.visibility = "visible";
        const at = layerAnchor(frame, i);
        node.style.top = `${at.top * 100}%`;
        node.style.setProperty("--layer-left", `${at.left * 100}%`);
        node.style.setProperty("--layer-right", `${at.right * 100}%`);
        node.style.transform =
          `translateY(-50%) translateX(${(1 - reveal) * (i % 2 ? 18 : -18)}px)`;
      }

      if (wipeRef.current) wipeRef.current.style.transform = `translateY(${(1 - wipe) * 100}%)`;
      if (wipeWordRef.current) {
        wipeWordRef.current.style.transform =
          `translateY(${(1 - wipe) * 70}px) scale(${0.88 + wipe * 0.12})`;
        wipeWordRef.current.style.opacity = String(wipe);
      }
      if (progressRef.current) progressRef.current.style.height = `${(stop / LAST_STOP) * 100}%`;

      const caption = captionRef.current;
      const phase = stopLabel(stop);
      if (phase !== caption.phase && phaseRef.current) {
        phaseRef.current.textContent = String(phase).padStart(2, "0");
        caption.phase = phase;
      }
      const step = stop < 0.5 ? c.scrollOpen
        : stop < 1.5 ? c.ingredientsStep
        : stop < 2.5 ? c.assembling : c.menuBelow;
      if (step !== caption.step && stepRef.current) {
        stepRef.current.textContent = step;
        caption.step = step;
      }
    };
    applyRef.current = apply;

    /**
     * The animation follows the scroll rather than being driven frame-for-frame
     * by it, and it has a speed limit.
     *
     * The approach is exponential in *elapsed time*, so it does not run twice as
     * fast on a 120Hz display as on a 60Hz one, and the per-frame movement is
     * then clamped — a hard flick cannot blast through the story, it just keeps
     * playing until it catches up.
     */
    const tick = (now: number) => {
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 1 / 60;
      last = now;

      const gap = target - shown;
      if (Math.abs(gap) < 0.0004) {
        shown = target;
        shownRef.current = shown;
        apply(shown);
        raf = 0;
        last = 0;
        return;
      }
      const eased = gap * (1 - Math.exp(-FOLLOW_RATE * dt));
      const cap = MAX_STOPS_PER_SEC * dt;
      shown += Math.max(-cap, Math.min(cap, eased));
      shownRef.current = shown;
      apply(shown);
      raf = requestAnimationFrame(tick);
    };

    const read = () => {
      const distance = section.offsetHeight - stageHeight();
      target = stopForProgress(-section.getBoundingClientRect().top / Math.max(1, distance));
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // start wherever the page already is, without animating into it
    const distance = section.offsetHeight - stageHeight();
    target = stopForProgress(-section.getBoundingClientRect().top / Math.max(1, distance));
    shown = target;
    shownRef.current = shown;
    apply(shown);

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    const ro = new ResizeObserver(read);
    ro.observe(section);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      ro.disconnect();
      applyRef.current = null;
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="scroll-story" id="top" ref={storyRef}>
      <div className="story-sticky" ref={stickyRef}>
        {/* settles the stage to the flat colour the closing frames were shot
            on, so those opaque frames have no visible edge */}
        <div className="story-studio" ref={studioRef} style={{ background: FINALE_BACKDROP }} aria-hidden="true" />
        <div className="story-grid" ref={gridRef} aria-hidden="true" />
        <header className="story-intro" ref={introRef}>
          <p className="eyebrow"><span /> {copy.open}</p>
          <h1>{copy.headline[0]}<br />{copy.headline[1]}</h1>
          <p>{copy.intro}</p>
        </header>
        <div className="story-title ingredients-title" ref={layersTitleRef}>
          <p>{copy.nothingHidden}</p><h2>{copy.layerByLayer}</h2>
        </div>
        <div className="story-title finish-title" ref={wholeTitleRef}>
          <p>{copy.simple}</p><h2>{copy.inPlace}</h2>
        </div>
        <div className="story-halo" ref={haloRef} />
        <div className="story-ground" ref={groundRef} aria-hidden="true" />
        <div className="story-burger" ref={burgerRef} style={{ aspectRatio: String(BURGER_SEQUENCE.aspect) }}>
          <FrameSequence
            ref={burgerSeq}
            source={BURGER_SEQUENCE}
            className="burger-media"
            label={copy.burgerAria}
            still={{ avif: "/burger-still.avif", fallback: "/burger-still.webp" }}
          />
          {copy.ingredientLabels.map((label, index) => (
            <div
              className={`ingredient-label label-${index + 1}`}
              key={label[0]}
              ref={(node) => { labelRefs.current[index] = node; }}
            >
              <span>0{index + 1}</span><strong>{label[0]}</strong><p>{label[1]}</p>
            </div>
          ))}
        </div>
        <div className="story-finale" ref={finaleRef}>
          <FrameSequence
            ref={finaleSeq}
            source={FINALE_SEQUENCE}
            className="burger-media"
            label={copy.boxAria}
            still={{ avif: "/finale-still.avif", fallback: "/finale-still.webp" }}
          />
        </div>
        <div className="story-wipe" ref={wipeRef}>
          <span ref={wipeWordRef}>{copy.menu.toUpperCase()}</span>
        </div>
        <div className="story-progress"><span ref={progressRef} /></div>
        <div className="story-phase"><strong ref={phaseRef}>01</strong><span>/ 0{LAST_STOP + 1}</span></div>
        <p className="story-step" ref={stepRef}>{copy.scrollOpen}</p>
      </div>
    </section>
  );
}
