"use client";

import { useEffect, useRef, useState } from "react";

import FrameSequence from "./FrameSequence";
import {
  BURGER_SEQUENCE, FINALE_BACKDROP, FINALE_OFFSET, FINALE_SCALE, FINALE_SEQUENCE, LAST_STOP,
  finaleFrameForStop, finaleSettle, finaleTakeover, frameForStop, introFade, labelReveal,
  layerAnchor, layersTitle, menuWipe, stopForProgress, stopLabel, studioFade, wholeTitle,
} from "./burgerStory";

/** how long one stop-to-stop transition takes */
const TRANSITION_MS = 650;
/** ignore further gestures until a transition has essentially landed */
const GESTURE_LOCK_MS = TRANSITION_MS + 60;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
   * Scroll chooses a destination; this plays the animation to it.
   *
   * The tween is driven by elapsed time, not by a per-frame fraction of the
   * remaining gap. A gap-based follow runs twice as fast on a 120Hz display as
   * on a 60Hz one, and spends its first frames lurching and its last crawling.
   */
  useEffect(() => {
    const current = () => {
      const { from, to, startedAt } = tweenRef.current;
      if (!startedAt) return to;
      const t = Math.min(1, (performance.now() - startedAt) / TRANSITION_MS);
      return from + (to - from) * easeInOutCubic(t);
    };

    const step = () => {
      const tw = tweenRef.current;
      const t = Math.min(1, (performance.now() - tw.startedAt) / TRANSITION_MS);
      const value = tw.from + (tw.to - tw.from) * easeInOutCubic(t);
      setStop(value);
      if (t >= 1) {
        tw.raf = 0;
        tw.startedAt = 0;
        return;
      }
      tw.raf = requestAnimationFrame(step);
    };

    const retarget = (to: number) => {
      const tw = tweenRef.current;
      if (tw.to === to && tw.startedAt) return;
      // restart from wherever the animation actually is, so a second gesture
      // mid-transition continues rather than jumping
      tw.from = current();
      tw.to = to;
      tw.startedAt = performance.now();
      if (!tw.raf) tw.raf = requestAnimationFrame(step);
    };

    const read = () => {
      const section = storyRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      retarget(stopForProgress(-rect.top / Math.max(1, distance)));
    };

    // settle on the starting stop without animating into it
    const section = storyRef.current;
    if (section) {
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      const at = stopForProgress(-rect.top / Math.max(1, distance));
      tweenRef.current = { from: at, to: at, startedAt: 0, raf: 0 };
      setStop(at);
    }

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      if (tweenRef.current.raf) cancelAnimationFrame(tweenRef.current.raf);
      tweenRef.current.raf = 0;
    };
  }, []);

  /**
   * One gesture, one stop.
   *
   * The jump is deliberately instant. The stage is `position: sticky`, so
   * moving the scroll inside the story changes nothing on screen — only the
   * number the tween reads. Animating the scroll as well meant the tween was
   * chasing a target the browser was still moving, and every hitch in that
   * scroll animation (which also fights scroll-snap) landed in the burger.
   */
  useEffect(() => {
    const section = storyRef.current;
    if (!section) return;
    let lastAt = 0;
    let touchY = 0;

    const filling = () => {
      const r = section.getBoundingClientRect();
      return r.top <= 1 && r.bottom >= window.innerHeight - 1;
    };
    const indexNow = () =>
      Math.round((window.scrollY - section.offsetTop) / Math.max(1, window.innerHeight));

    const go = (dir: number) => {
      const next = indexNow() + dir;
      if (next < 0 || next > LAST_STOP) return false; // let the page have it
      // "instant", not "auto": auto defers to the element's scroll-behavior,
      // which is `smooth` on <html> for the nav anchors — that would animate the
      // scroll again and put us right back to a tween chasing a moving target.
      window.scrollTo({ top: section.offsetTop + next * window.innerHeight, behavior: "instant" });
      return true;
    };

    const take = (dir: number, e: Event) => {
      const now = performance.now();
      if (now - lastAt < GESTURE_LOCK_MS) {
        e.preventDefault(); // swallow the tail of a flick so it moves one stop
        return;
      }
      if (go(dir)) {
        e.preventDefault();
        lastAt = now;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!filling() || Math.abs(e.deltaY) < 2) return;
      take(e.deltaY > 0 ? 1 : -1, e);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!filling()) return;
      const dy = touchY - (e.touches[0]?.clientY ?? 0);
      if (Math.abs(dy) < 24) return;
      take(dy > 0 ? 1 : -1, e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!filling()) return;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
      const up = e.key === "ArrowUp" || e.key === "PageUp";
      if (down || up) take(down ? 1 : -1, e);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
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
      {/* One marker per stop. These are what the browser snaps to, so a
          single gesture moves exactly one phase of the story. */}
      <div className="story-stops" aria-hidden="true">
        {Array.from({ length: LAST_STOP + 1 }, (_, i) => <div key={i} className="story-stop" />)}
      </div>
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
