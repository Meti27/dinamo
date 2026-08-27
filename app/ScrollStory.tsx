"use client";

import { useEffect, useRef } from "react";

import FrameSequence, { type FrameSequenceHandle } from "./FrameSequence";
import {
  BURGER_SEQUENCE, FINALE_BACKDROP, FINALE_OFFSET, FINALE_SCALE, FINALE_SEQUENCE, LAST_STOP,
  finaleFrameForStop, finaleSettle, finaleTakeover, frameForStop, introFade, labelReveal,
  layerAnchor, layersTitle, mediaScale, menuWipe, stepIndex, stopForProgress, stopLabel,
  studioFade, wholeTitle,
} from "./burgerStory";

/**
 * How quickly the animation closes the gap to wherever the scroll is, per
 * second. 11 lands 63% of a correction in ~90ms: close enough to read as welded
 * to the scrollbar, loose enough to swallow the jitter of a wheel notch.
 *
 * There is deliberately no speed limit any more. The old `MAX_STOPS_PER_SEC`
 * cap meant a hard flick left the burger still playing after you had stopped
 * scrolling, which is most of what "laggy" described — the picture was no
 * longer answering to the hand. The story now has enough scroll length
 * (`.scroll-story` is 900svh) that a flick does not need to be fought.
 */
const FOLLOW_RATE = 11;

/** gap between a label and whatever it hangs off — the burger, or the frame */
const LABEL_GAP = 12;
/** how far a label slides in from as it appears, in px */
const LABEL_SLIDE = 18;
/**
 * Below this width the labels pin to the edges of the frame instead of tracking
 * the burger's own edges — at that size there is no room beside the food, and a
 * label that follows a layer outwards ends up on top of it. Matches the
 * breakpoint in globals.css that flips their alignment and padding.
 */
const EDGE_PINNED = "(max-width: 560px)";

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
 * Everything the loop needs to know about the page's geometry.
 *
 * Measured on resize and never inside the animation. Reading `offsetHeight` in
 * the middle of a frame that has already written styles forces the browser to
 * lay the page out again, synchronously, before it can answer — which is what
 * `apply` used to do twice per frame, and what made a mid-range phone drop
 * frames. Off the loop it costs nothing.
 */
type Metrics = {
  stageH: number;
  /** scrollable distance of the section past its sticky stage */
  travel: number;
  burgerW: number;
  burgerH: number;
  /** the burger box's left edge, in stage coordinates */
  burgerX: number;
  stageW: number;
  /** labels sit against the frame rather than the burger — see EDGE_PINNED */
  edgePinned: boolean;
  /** the size the closing beat settles at; it is scaled to this, never resized */
  finaleBase: number;
  /** px the closing beat travels sideways as it settles to the stage centre */
  finaleDx: number;
  labelW: number[];
  labelH: number[];
};

/**
 * The story stage.
 *
 * Nothing here is React state. The animation runs at display rate, and putting
 * it through a render — even one scoped to this component — means reconciling
 * twenty-odd elements sixty times a second, which is what a mid-range phone
 * cannot keep up with. The loop writes to the DOM directly instead; React only
 * builds the structure and swaps the copy when the language changes.
 *
 * Every one of those writes is `opacity` or `transform`. Both are handled by the
 * compositor, so a frame never invalidates layout — no `top`, no `left`, no
 * `height`, and no geometry read to compute them.
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
  const burgerScaleRef = useRef<HTMLDivElement>(null);
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
  const captionRef = useRef({ phase: -1, step: -1 });

  // copy only changes when the language is switched; re-apply so the captions
  // pick it up without waiting for the next scroll
  useEffect(() => {
    copyRef.current = copy;
    captionRef.current = { phase: -1, step: -1 };
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
    let dirty = true;

    const m: Metrics = {
      stageH: 0, travel: 1, burgerW: 0, burgerH: 0, burgerX: 0, stageW: 0,
      edgePinned: false, finaleBase: 0, finaleDx: 0, labelW: [], labelH: [],
    };

    /**
     * The one place the page's geometry is read. Called on resize, never per
     * frame.
     *
     * The stage is measured rather than taken from `window.innerHeight`: the
     * section is sized in `svh`, which is stable, while `innerHeight` grows as a
     * phone's URL bar collapses. Mixing them made the denominator move
     * mid-scroll, so progress jumped — visible as a stutter on mobile and
     * nowhere else.
     */
    const measure = () => {
      m.stageH = sticky.offsetHeight || window.innerHeight;
      m.stageW = sticky.offsetWidth;
      m.travel = Math.max(1, section.offsetHeight - m.stageH);
      m.edgePinned = window.matchMedia(EDGE_PINNED).matches;

      const burger = burgerRef.current;
      m.burgerW = burger?.offsetWidth ?? 0;
      m.burgerH = burger?.offsetHeight ?? 0;
      // `.story-burger` is centred on its anchor with translate(-50%,-50%), which
      // offsetLeft does not account for, so its visual left edge is half a box left
      m.burgerX = (burger?.offsetLeft ?? 0) - m.burgerW / 2;

      // The closing beat is given its settled size once, here, and scaled to
      // everything smaller. Animating its `height` instead meant a layout on
      // every frame of the beat — and re-sizing the canvas element under it.
      const base = Math.min(m.stageH * 0.84, window.innerWidth * 0.94, 760);
      m.finaleBase = base;
      const el = finaleRef.current;
      if (el) {
        el.style.width = `${base}px`;
        el.style.height = `${base}px`;
        // its CSS `left` puts it over the burger; this is the distance from
        // there to the middle of the stage, which is where it settles
        m.finaleDx = sticky.offsetWidth / 2 - el.offsetLeft;
      }

      for (let i = 0; i < labelRefs.current.length; i++) {
        const node = labelRefs.current[i];
        m.labelW[i] = node?.offsetWidth ?? 0;
        m.labelH[i] = node?.offsetHeight ?? 0;
      }
    };

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
        introRef.current.style.transform =
          `translate3d(0,${Math.min(stop, 1) * -70}px,0)`;
        introRef.current.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      if (layersTitleRef.current) layersTitleRef.current.style.opacity = String(layersTitle(stop));
      if (wholeTitleRef.current) wholeTitleRef.current.style.opacity = String(wholeTitle(stop));

      // the two sequences cross-fade rather than cut, so the handoff between two
      // separate renders of the same burger does not show a seam
      if (burgerRef.current) burgerRef.current.style.opacity = String(1 - boxed);
      // the picture is scaled to the pose; see mediaScale
      const zoom = mediaScale(frame);
      if (burgerScaleRef.current) burgerScaleRef.current.style.transform = `scale(${zoom})`;
      if (groundRef.current) groundRef.current.style.opacity = String((1 - boxed) * veil);

      const el = finaleRef.current;
      if (el) {
        const mix = (a: number, b: number) => a + (b - a) * settle;
        const h = mix(m.burgerH * FINALE_SCALE, m.finaleBase);

        el.style.opacity = String(boxed);
        el.style.visibility = boxed < 0.004 ? "hidden" : "visible";
        el.style.transform =
          `translate(-50%,-50%) translate3d(${m.finaleDx * settle}px,`
          + `${mix(FINALE_OFFSET * m.burgerH, 0)}px,0)`
          + ` scale(${m.finaleBase ? h / m.finaleBase : 1})`;
      }

      // One transform each, in px against the burger box measured on resize.
      // These used to be a percentage `top` plus two custom properties feeding a
      // `calc()` in `left`/`right` — three layout-invalidating writes per label,
      // six labels, every frame. Skipped entirely while invisible, which is most
      // of the story.
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
        const slide = (1 - reveal) * LABEL_SLIDE;
        // the anchors are fractions of the unscaled frame, so carry them through
        // the same scale the picture is drawn at, about the box's centre
        const ax = m.burgerW / 2 + (m.burgerW * at.left - m.burgerW / 2) * zoom;
        const bx = m.burgerW / 2 + (m.burgerW * at.right - m.burgerW / 2) * zoom;
        const ay = m.burgerH / 2 + (m.burgerH * at.top - m.burgerH / 2) * zoom;
        // odd-numbered labels sit to the left, even to the right; both are in
        // the burger box's own coordinates, which is what the transform is on
        const left = i % 2 === 0;
        const x = m.edgePinned
          ? (left
            ? LABEL_GAP - m.burgerX - slide
            : m.stageW - LABEL_GAP - m.labelW[i] - m.burgerX + slide)
          : (left
            ? ax - LABEL_GAP - m.labelW[i] - slide
            : bx + LABEL_GAP + slide);
        const y = ay - m.labelH[i] / 2;
        node.style.transform = `translate3d(${x}px,${y}px,0)`;
      }

      if (wipeRef.current) wipeRef.current.style.transform = `translate3d(0,${(1 - wipe) * 100}%,0)`;
      if (wipeWordRef.current) {
        wipeWordRef.current.style.transform =
          `translate3d(0,${(1 - wipe) * 70}px,0) scale(${0.88 + wipe * 0.12})`;
        wipeWordRef.current.style.opacity = String(wipe);
      }
      // scaled rather than sized, so the progress bar is not a layout write
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleY(${stop / LAST_STOP})`;
      }

      const caption = captionRef.current;
      const phase = stopLabel(stop);
      if (phase !== caption.phase && phaseRef.current) {
        phaseRef.current.textContent = String(phase).padStart(2, "0");
        caption.phase = phase;
      }
      const step = stepIndex(stop);
      if (step !== caption.step && stepRef.current) {
        stepRef.current.textContent =
          [c.scrollOpen, c.ingredientsStep, c.assembling, c.menuBelow][step];
        caption.step = step;
      }
    };
    applyRef.current = apply;

    /**
     * One frame: read where the scroll is, ease towards it, draw.
     *
     * The scroll position is read here, at the top of the frame and before any
     * write, rather than in the scroll handler — a `getBoundingClientRect` is a
     * layout read, and on a phone the scroll handler can fire several times per
     * displayed frame. The easing is exponential in *elapsed time*, so it does
     * not converge twice as fast on a 120Hz display as on a 60Hz one.
     */
    const tick = (now: number) => {
      if (dirty) {
        dirty = false;
        target = stopForProgress(-section.getBoundingClientRect().top / m.travel);
      }

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
      shown += gap * (1 - Math.exp(-FOLLOW_RATE * dt));
      shownRef.current = shown;
      apply(shown);
      raf = requestAnimationFrame(tick);
    };

    /** cheapest possible scroll handler: flag it, and make sure a frame is due */
    const read = () => {
      dirty = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const remeasure = () => {
      measure();
      dirty = true;
      apply(shown < 0 ? 0 : shown);
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // start wherever the page already is, without animating into it
    measure();
    target = stopForProgress(-section.getBoundingClientRect().top / m.travel);
    shown = target;
    shownRef.current = shown;
    dirty = false;
    apply(shown);

    // label heights depend on the webfont, which may land after first paint
    document.fonts?.ready.then(remeasure).catch(() => {});

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(section);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", remeasure);
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
          {/* only the picture scales — the labels are siblings, so their text
              stays at its own size and only their anchors follow the zoom */}
          <div className="burger-scale" ref={burgerScaleRef}>
            <FrameSequence
              ref={burgerSeq}
              source={BURGER_SEQUENCE}
              className="burger-media"
              label={copy.burgerAria}
              still={{ avif: "/burger-still.avif", fallback: "/burger-still.webp" }}
            />
          </div>
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
