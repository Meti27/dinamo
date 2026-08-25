"use client";

import { useEffect, useRef, useState } from "react";

import FrameSequence from "./FrameSequence";
import {
  BURGER_SEQUENCE, FINALE_BACKDROP, FINALE_OFFSET, FINALE_SCALE, FINALE_SEQUENCE, LAST_STOP,
  finaleFrameForStop, finaleSettle, finaleTakeover, frameForStop, introFade, labelReveal,
  layerAnchor, layersTitle, menuWipe, stopForProgress, stopLabel, studioFade, wholeTitle,
} from "./burgerStory";

type Lang = "bs" | "en";
type Category = "all" | "burgers" | "ice" | "drinks";

const items = [
  { category: "ice", name: { bs: "Vanilja", en: "Vanilla" }, price: "1.5 KM", image: "/menu/ice-vanilja.avif" },
  { category: "ice", name: { bs: "Nutella", en: "Nutella" }, price: "1.5 KM", image: "/menu/ice-nutella.avif" },
  { category: "ice", name: { bs: "Lješnjak", en: "Hazelnut" }, price: "1.5 KM", image: "/menu/ice-ljesnjak.avif" },
  { category: "ice", name: { bs: "Čokolada", en: "Chocolate" }, price: "1.5 KM", image: "/menu/ice-cokolada.avif" },
  { category: "ice", name: { bs: "Jagoda", en: "Strawberry" }, price: "1.5 KM", image: "/menu/ice-jagoda.avif" },
  { category: "ice", name: { bs: "Limun", en: "Lemon" }, price: "1.5 KM", image: "/menu/ice-limun.avif" },
  { category: "burgers", name: { bs: "Hamburger", en: "Hamburger" }, price: "5 KM", image: "/menu/burgers-hamburger.avif" },
  { category: "burgers", name: { bs: "Cheeseburger", en: "Cheeseburger" }, price: "6 KM", image: "/menu/burgers-cheeseburger.avif" },
  { category: "burgers", name: { bs: "Double hamburger", en: "Double hamburger" }, price: "9 KM", image: "/menu/burgers-double-hamburger.avif" },
  { category: "drinks", name: { bs: "Limunada", en: "Lemonade" }, price: "1.5 KM", note: "200 ml", image: "/menu/drinks-limunada.avif" },
  { category: "drinks", name: { bs: "Cola", en: "Cola" }, price: "2.5 KM", note: "250 ml", image: "/menu/drinks-cola.avif" },
  { category: "drinks", name: { bs: "Fanta", en: "Fanta" }, price: "2.5 KM", note: "250 ml", image: "/menu/drinks-fanta.avif" },
  { category: "drinks", name: { bs: "Voda", en: "Water" }, price: "2 KM", note: "500 ml", image: "/menu/drinks-voda.avif" },
  { category: "drinks", name: { bs: "Ice tea", en: "Iced tea" }, price: "2.5 KM", image: "/menu/drinks-ice-tea.avif" },
] as const;

const categoryKeys: Category[] = ["all", "burgers", "ice", "drinks"];

const translations = {
  bs: {
    menu: "Meni", location: "Lokacija", call: "Pozovi", open: "Orašje · od 08 do 23h",
    headline: ["Glad ne", "čeka."], intro: "Skrolaj i upoznaj naš burger.",
    nothingHidden: "NIŠTA NE KRIJEMO", layerByLayer: "Sloj po sloj.",
    simple: "JEDNOSTAVNO. SVJEŽE. UKUSNO.", inPlace: "Sve na svom mjestu.",
    scrollOpen: "SKROLAJ DA OTVORIŠ BURGER", ingredientsStep: "NAŠI SASTOJCI", assembling: "SASTAVLJAMO", menuBelow: "MENI JE ISPOD",
    ticker: "BURGERI ✦ SLADOLED ✦ DOBAR OSJEĆAJ ✦ BURGERI ✦ SLADOLED ✦",
    choose: "IZABERI SVOJ FAVORIT", ourMenu: "Naš meni", filterLabel: "Filtriraj meni",
    where: "GDJE SMO?", seeYou: ["Vidimo se", "u Dinamu."], country: "Bosna i Hercegovina",
    everyDay: "SVAKI DAN", callUs: "Pozovi nas", backTop: "NA VRH ↑",
    logoLine: "HAMBURGERI · SLADOLED · ORAŠJE",
    categories: { all: "Sve", burgers: "Burgeri", ice: "Sladoled", drinks: "Pića" },
    ingredientLabels: [
      ["Brioche pecivo", "Mekano, zlatno i uvijek svježe."],
      ["Svježe povrće", "Hrskava salata, paradajz i crveni luk."],
      ["Topljeni cheddar", "Kremasti sloj koji veže svaki zalogaj."],
      ["100% goveđe meso", "Sočno, začinjeno i pečeno na grilu."],
      ["Dinamo sos", "Kiseli krastavci i naš sočni potpis."],
      ["Tostirano pecivo", "Čvrsta baza za burger bez kompromisa."],
    ],
    burgerAria: "Dinamo burger koji se rastavlja na šest svježih sastojaka",
    boxAria: "Dinamo burger se slaže i zatvara u kutiju s logom",
  },
  en: {
    menu: "Menu", location: "Location", call: "Call us", open: "Orašje · open 8am–11pm",
    headline: ["Hunger", "won’t wait."], intro: "Scroll to discover our burger.",
    nothingHidden: "NOTHING TO HIDE", layerByLayer: "Layer by layer.",
    simple: "SIMPLE. FRESH. DELICIOUS.", inPlace: "Everything in place.",
    scrollOpen: "SCROLL TO OPEN THE BURGER", ingredientsStep: "OUR INGREDIENTS", assembling: "ASSEMBLING", menuBelow: "THE MENU IS BELOW",
    ticker: "BURGERS ✦ ICE CREAM ✦ GOOD VIBES ✦ BURGERS ✦ ICE CREAM ✦",
    choose: "CHOOSE YOUR FAVORITE", ourMenu: "Our menu", filterLabel: "Filter menu",
    where: "FIND US", seeYou: ["See you", "at Dinamo."], country: "Bosnia and Herzegovina",
    everyDay: "EVERY DAY", callUs: "Call us", backTop: "BACK TO TOP ↑",
    logoLine: "BURGERS · ICE CREAM · ORAŠJE",
    categories: { all: "All", burgers: "Burgers", ice: "Ice cream", drinks: "Drinks" },
    ingredientLabels: [
      ["Brioche bun", "Soft, golden and always fresh."],
      ["Fresh vegetables", "Crisp lettuce, tomato and red onion."],
      ["Melted cheddar", "A creamy layer that holds every bite together."],
      ["100% beef", "Juicy, seasoned and flame-grilled."],
      ["Dinamo sauce", "Pickles and our signature juicy finish."],
      ["Toasted bun", "A solid base for a no-compromise burger."],
    ],
    burgerAria: "Dinamo burger separating into six fresh ingredient layers",
    boxAria: "The Dinamo burger settling into a branded box",
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>("bs");
  const [category, setCategory] = useState<Category>("all");
  const [scrolled, setScrolled] = useState(false);
  // `target` is where the scroll says we should be; `stop` is where the
  // animation actually is, easing toward it on its own clock.
  const [stop, setStop] = useState(0);
  const targetRef = useRef(0);
  const stopRef = useRef(0);
  const easeRef = useRef(0);
  const storyRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLDivElement>(null);
  // the closing beat is sized against the burger it takes over from, so it has
  // to know how tall that actually rendered — the height is a responsive clamp
  const [stage, setStage] = useState({ burgerH: 0, viewportH: 0, viewportW: 0 });
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("dinamo-language", lang);
  }, [lang]);

  useEffect(() => {
    const saved = localStorage.getItem("dinamo-language");
    if (saved === "en" || saved === "bs") setLang(saved);
  }, []);

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

  useEffect(() => {
    // Scroll only chooses a destination. A separate loop eases the animation
    // toward it, so playback stays smooth however coarsely the wheel is turned
    // and however far a single flick jumps.
    const ease = () => {
      easeRef.current = 0;
      const gap = targetRef.current - stopRef.current;
      if (Math.abs(gap) < 0.002) {
        if (stopRef.current !== targetRef.current) {
          stopRef.current = targetRef.current;
          setStop(targetRef.current);
        }
        return;
      }
      stopRef.current += gap * 0.16;
      setStop(stopRef.current);
      easeRef.current = requestAnimationFrame(ease);
    };
    const kick = () => {
      if (!easeRef.current) easeRef.current = requestAnimationFrame(ease);
    };

    const read = () => {
      setScrolled(window.scrollY > 40);
      const section = storyRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      targetRef.current = stopForProgress(-rect.top / Math.max(1, distance));
      kick();
    };

    // Snap lands the scroll on a stop; jumping straight there avoids easing
    // toward a destination the browser is still animating past.
    read();
    stopRef.current = targetRef.current;
    setStop(targetRef.current);

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      if (easeRef.current) cancelAnimationFrame(easeRef.current);
      easeRef.current = 0;
    };
  }, []);

  // One gesture, one stop. Snapping alone goes to the *nearest* point, so a
  // single wheel notch would fall back to the stop it started from; this takes
  // the gesture and moves a whole stop. It only binds while the story fills the
  // viewport, and hands the gesture back at either end so the page scrolls on.
  useEffect(() => {
    const section = storyRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
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
      window.scrollTo({
        top: section.offsetTop + next * window.innerHeight,
        behavior: reduced.matches ? "auto" : "smooth",
      });
      return true;
    };

    const take = (dir: number, e: Event) => {
      const now = performance.now();
      if (now - lastAt < 640) {
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

  const shown = category === "all" ? items : items.filter((item) => item.category === category);
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
    <main>
      <nav className={scrolled ? "nav scrolled" : "nav"}>
        <a className="brand" href="#top" aria-label="Dinamo home"><img src="/dinamo.jpg" alt="Dinamo" /><span>DINAMO</span></a>
        <div className="nav-links"><a href="#menu">{t.menu}</a><a href="#lokacija">{t.location}</a></div>
        <div className="nav-actions">
          <div className="lang-switch" role="group" aria-label="Language">
            <button className={lang === "bs" ? "active" : ""} onClick={() => setLang("bs")} aria-pressed={lang === "bs"}>BS</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
          </div>
          <a className="nav-call" href="tel:063553739">{t.call}</a>
        </div>
      </nav>

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
            <p className="eyebrow"><span /> {t.open}</p>
            <h1>{t.headline[0]}<br />{t.headline[1]}</h1>
            <p>{t.intro}</p>
          </header>
          <div className="story-title ingredients-title" style={{ opacity: layersTitle(stop) }}>
            <p>{t.nothingHidden}</p><h2>{t.layerByLayer}</h2>
          </div>
          <div className="story-title finish-title" style={{ opacity: wholeTitle(stop) }}>
            <p>{t.simple}</p><h2>{t.inPlace}</h2>
          </div>
          <div className="story-halo" style={{ opacity: 1 - studio }} />
          <div ref={burgerRef} className="story-burger" style={{ opacity: boxed ? 0 : 1, aspectRatio: String(BURGER_SEQUENCE.aspect) }}>
            <FrameSequence
              source={BURGER_SEQUENCE}
              frame={frame}
              className="burger-media"
              label={t.burgerAria}
              still={{ avif: "/burger-still.avif", fallback: "/burger-still.webp" }}
            />
            {t.ingredientLabels.map((label, index) => {
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
              label={t.boxAria}
              still={{ avif: "/finale-still.avif", fallback: "/finale-still.webp" }}
            />
          </div>
          <div className="story-wipe" style={{ transform: `translateY(${(1 - wipe) * 100}%)` }}>
            <span style={{ transform: `translateY(${(1 - wipe) * 70}px) scale(${.88 + wipe * .12})`, opacity: wipe }}>{t.menu.toUpperCase()}</span>
          </div>
          <div className="story-progress"><span style={{ height: `${(stop / LAST_STOP) * 100}%` }} /></div>
          <div className="story-phase"><strong>{String(stopLabel(stop)).padStart(2, "0")}</strong><span>/ 0{LAST_STOP + 1}</span></div>
          <p className="story-step">{stop < 0.5 ? t.scrollOpen : stop < 1.5 ? t.ingredientsStep : stop < 2.5 ? t.assembling : t.menuBelow}</p>
        </div>
      </section>

      <section className="ticker" aria-hidden="true"><div>{t.ticker} &nbsp; {t.ticker}</div></section>

      <section className="menu-section" id="menu">
        <div className="menu-heading">
          <div><p className="section-kicker light">{t.choose}</p><h2>{t.ourMenu}</h2></div>
          <div className="filters" role="group" aria-label={t.filterLabel}>
            {categoryKeys.map((cat) => <button key={cat} className={category === cat ? "active" : ""} onClick={() => setCategory(cat)}>{t.categories[cat]}</button>)}
          </div>
        </div>
        <div className="menu-grid">{shown.map((item,index) => <article className="menu-card" style={{ "--card-index": index } as React.CSSProperties} key={item.name.bs}>
          <div className="card-image"><img src={item.image} alt={item.name[lang]} width={520} height={520} loading="lazy" decoding="async" /><span>{t.categories[item.category]}</span></div>
          <div className="card-info"><div><h3>{item.name[lang]}</h3>{"note" in item && item.note && <p>{item.note}</p>}</div><strong>{item.price}</strong></div>
        </article>)}</div>
      </section>

      <section className="location" id="lokacija">
        <div className="location-copy">
          <p className="section-kicker">{t.where}</p><h2>{t.seeYou[0]}<br />{t.seeYou[1]}</h2>
          <p>Donja Mahala, Ulica Školska 18<br />Orašje, {t.country}</p>
          <div className="hours"><span>{t.everyDay}</span><strong>08:00 — 23:00</strong></div>
          <div className="location-actions"><a className="button primary" href="tel:063553739">{t.callUs}</a><a className="button dark" href="https://www.instagram.com/slasticarnadinamo" target="_blank" rel="noreferrer">Instagram ↗</a></div>
        </div>
        <div className="logo-panel"><div className="rings" /><img src="/dinamo.jpg" alt="Dinamo logo" /><p>{t.logoLine}</p></div>
      </section>

      <footer><a className="brand footer-brand" href="#top"><img src="/dinamo.jpg" alt="" /><span>DINAMO</span></a><p>© 2026 Dinamo Orašje</p><a href="#top">{t.backTop}</a></footer>
    </main>
  );
}
