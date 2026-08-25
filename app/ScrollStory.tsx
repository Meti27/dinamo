"use client";

import { useEffect, useRef, useState } from "react";

import FrameSequence from "./FrameSequence";
import {
  BURGER_SEQUENCE, FINALE_BACKDROP, FINALE_OFFSET, FINALE_SCALE, FINALE_SEQUENCE, LAST_STOP,
  finaleFrameForStop, finaleSettle, finaleTakeover, frameForStop, introFade, labelReveal,
  layerAnchor, layersTitle, menuWipe, stopForProgress, stopLabel, studioFade, wholeTitle,
} from "./burgerStory";

/**
 * How quickly the animation closes the gap to wherever the scroll is, per
 * second. Higher feels more directly attached to the wheel, lower feels
 * floatier.
 */
const FOLLOW_RATE = 12;

/**
 * The speed limit, in stops per second. Scroll as hard as you like — the story
 * will not advance faster than this, it just keeps playing until it catches up.
 * This is what stops a violent flick from blasting through the whole thing.
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
 * The story stage, kept in its own component so the animation does not
 * reconcile the rest of the page. Every frame of a transition sets state; with
 * this living in the page component that meant re-rendering the menu grid, the
 * location block and the footer sixty times a second for nothing.
 */
export default function ScrollStory({ copy }: { copy: Copy }) {
  const [stop, setStop] = useState(0);
  const [stage, setStage] = useState({ burgerH: 0, viewportH: 0, viewportW: 0 });

  const storyRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef({ from: 0, to: 0, startedAt: 0, raf: 0 });

  // the closing beat is sized against the burger it takes over from, so it has
  // to know how tall that actually rendered — the height is a responsive clamp
  useEffect(() => {
    const el = burgerRef.current;
    if (!el) return;
    const measure = () =>
      setStage({
        burgerH: el.getBoundingClientRect().height,
        viewportH: window.innerHeight,
        viewportW: window.innerWidth,
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /**
   * The animation follows the scroll rather than being driven frame-for-frame
   * by it, and it has a speed limit.
   *
   * Two things this fixes. Reading the scroll position straight into the frame
   * index means a coarse or violent wheel jumps the burger; and closing a fixed
   * fraction of the gap per frame runs twice as fast on a 120Hz display as on a
   * 60Hz one. So the approach is exponential in *elapsed time*, then clamped so
   * the story can never advance faster than MAX_STOPS_PER_SEC no matter how
   * hard the scroll was.
   */
  useEffect(() => {
    const target = { at: 0 };
    const shown = { at: 0 };
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 1 / 60;
      last = now;

      const gap = target.at - shown.at;
      if (Math.abs(gap) < 0.0004) {
        shown.at = target.at;
        setStop(target.at);
        raf = 0;
        last = 0;
        return;
      }

      const eased = gap * (1 - Math.exp(-FOLLOW_RATE * dt));
      const cap = MAX_STOPS_PER_SEC * dt;
      shown.at += Math.max(-cap, Math.min(cap, eased));
      setStop(shown.at);
      raf = requestAnimationFrame(tick);
    };

    const read = () => {
      const section = storyRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      target.at = stopForProgress(-rect.top / Math.max(1, distance));
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // start wherever the page already is, without animating into it
    const section = storyRef.current;
    if (section) {
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      const at = stopForProgress(-rect.top / Math.max(1, distance));
      target.at = at;
      shown.at = at;
      setStop(at);
    }

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const frame = frameForStop(stop);
  const finaleFrame = finaleFrameForStop(stop);
  const boxed = finaleTakeover(stop);
  const settle = finaleSettle(stop);
  const mix = (a: number, b: number) => a + (b - a) * settle;
  // starts matched to the burger's framing, ends centred and fitted. The frame
  // is square, so the width bound matters as much as the height one on a phone.
  const finaleH = mix(
    stage.burgerH * FINALE_SCALE,
    Math.min(stage.viewportH * 0.84, stage.viewportW * 0.94, 760),
  );
  const finaleY = mix(FINALE_OFFSET * stage.burgerH, 0);
  const studio = studioFade(stop);
  const wipe = menuWipe(stop);

  return (
    <section className="scroll-story" id="top" ref={storyRef}>
      <div className="story-sticky">
        {/* settles the stage to the flat colour the closing frames were shot
            on, so those opaque frames have no visible edge */}
        <div className="story-studio" style={{ background: FINALE_BACKDROP, opacity: studio }} aria-hidden="true" />
        <div className="story-grid" aria-hidden="true" style={{ opacity: 1 - studio }} />
        <header className="story-intro" style={{ opacity: introFade(stop), transform: `translateY(${Math.min(stop, 1) * -70}px)` }}>
          <p className="eyebrow"><span /> {copy.open}</p>
          <h1>{copy.headline[0]}<br />{copy.headline[1]}</h1>
          <p>{copy.intro}</p>
        </header>
        <div className="story-title ingredients-title" style={{ opacity: layersTitle(stop) }}>
          <p>{copy.nothingHidden}</p><h2>{copy.layerByLayer}</h2>
        </div>
        <div className="story-title finish-title" style={{ opacity: wholeTitle(stop) }}>
          <p>{copy.simple}</p><h2>{copy.inPlace}</h2>
        </div>
        <div className="story-halo" style={{ opacity: 1 - studio }} />
        <div className="story-ground" style={{ opacity: boxed ? 0 : 1 }} aria-hidden="true" />
        <div ref={burgerRef} className="story-burger" style={{ opacity: boxed ? 0 : 1, aspectRatio: String(BURGER_SEQUENCE.aspect) }}>
          <FrameSequence
            source={BURGER_SEQUENCE}
            frame={frame}
            className="burger-media"
            label={copy.burgerAria}
            still={{ avif: "/burger-still.avif", fallback: "/burger-still.webp" }}
          />
          {copy.ingredientLabels.map((label, index) => {
            const reveal = labelReveal(stop, index);
            const at = layerAnchor(frame, index);
            return (
              <div
                className={`ingredient-label label-${index + 1}`}
                key={label[0]}
                style={{
                  top: `${at.top * 100}%`,
                  // the narrow layers sit well inside the box, so each rule is
                  // anchored to its own layer's edge rather than the box's
                  "--layer-left": `${at.left * 100}%`,
                  "--layer-right": `${at.right * 100}%`,
                  opacity: reveal,
                  transform: `translateY(-50%) translateX(${(1 - reveal) * (index % 2 ? 18 : -18)}px)`,
                } as React.CSSProperties}
              >
                <span>0{index + 1}</span><strong>{label[0]}</strong><p>{label[1]}</p>
              </div>
            );
          })}
        </div>
        <div
          className="story-finale"
          style={{
            opacity: boxed,
            left: `${mix(54, 50)}%`,
            height: `${finaleH}px`,
            transform: `translate(-50%, -50%) translateY(${finaleY}px)`,
          }}
        >
          <FrameSequence
            source={FINALE_SEQUENCE}
            frame={finaleFrame}
            className="burger-media"
            label={copy.boxAria}
            still={{ avif: "/finale-still.avif", fallback: "/finale-still.webp" }}
          />
        </div>
        <div className="story-wipe" style={{ transform: `translateY(${(1 - wipe) * 100}%)` }}>
          <span style={{ transform: `translateY(${(1 - wipe) * 70}px) scale(${.88 + wipe * .12})`, opacity: wipe }}>{copy.menu.toUpperCase()}</span>
        </div>
        <div className="story-progress"><span style={{ height: `${(stop / LAST_STOP) * 100}%` }} /></div>
        <div className="story-phase"><strong>{String(stopLabel(stop)).padStart(2, "0")}</strong><span>/ 0{LAST_STOP + 1}</span></div>
        <p className="story-step">{stop < 0.5 ? copy.scrollOpen : stop < 1.5 ? copy.ingredientsStep : stop < 2.5 ? copy.assembling : copy.menuBelow}</p>
      </div>
    </section>
  );
}
