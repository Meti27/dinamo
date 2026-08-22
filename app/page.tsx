"use client";

import { useEffect, useRef, useState } from "react";

type Lang = "bs" | "en";
type Category = "all" | "burgers" | "ice" | "drinks";

const items = [
  { category: "ice", name: { bs: "Vanilja", en: "Vanilla" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c30abc491caeecc3b0f4d0e323.avif" },
  { category: "ice", name: { bs: "Nutella", en: "Nutella" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c32fd03cef8b345a2e103665cf.avif" },
  { category: "ice", name: { bs: "Lješnjak", en: "Hazelnut" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c44eab7555b41b4262a84a0f1e.avif" },
  { category: "ice", name: { bs: "Čokolada", en: "Chocolate" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c4736cc7fcaf59c4e53afeccfa.avif" },
  { category: "ice", name: { bs: "Jagoda", en: "Strawberry" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c47388df29859254dd9b23869b.avif" },
  { category: "ice", name: { bs: "Limun", en: "Lemon" }, price: "1.5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c4976d4413a152613afa01f3c3.avif" },
  { category: "burgers", name: { bs: "Hamburger", en: "Hamburger" }, price: "5 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c526d7d87dbc4ba6f70e5b529b.avif" },
  { category: "burgers", name: { bs: "Cheeseburger", en: "Cheeseburger" }, price: "6 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c54b07d928a1dd3d4cbc1849eb.avif" },
  { category: "burgers", name: { bs: "Double hamburger", en: "Double hamburger" }, price: "9 KM", image: "https://media.dodostatic.com/image/r:520x520/11ee39c56f1a4fd0a53ece8fac3fca51.avif" },
  { category: "drinks", name: { bs: "Limunada", en: "Lemonade" }, price: "1.5 KM", note: "200 ml", image: "https://media.dodostatic.com/image/r:520x520/11ee3d1d18828ca18e6ce61ad4e3b096.avif" },
  { category: "drinks", name: { bs: "Cola", en: "Cola" }, price: "2.5 KM", note: "250 ml", image: "https://media.dodostatic.com/image/r:520x520/11ee3d0c50023841a02aebfb64854d65.avif" },
  { category: "drinks", name: { bs: "Fanta", en: "Fanta" }, price: "2.5 KM", note: "250 ml", image: "https://media.dodostatic.com/image/r:520x520/11ee3d0c5011d13e917daee85c82b054.avif" },
  { category: "drinks", name: { bs: "Voda", en: "Water" }, price: "2 KM", note: "500 ml", image: "https://media.dodostatic.com/image/r:520x520/11ee3d0c73f50a4a924f4e5d1e4c5220.avif" },
  { category: "drinks", name: { bs: "Ice tea", en: "Iced tea" }, price: "2.5 KM", image: "https://media.dodostatic.com/image/r:520x520/0198286c615871deac4f9ef8dc400643.avif" },
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
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>("bs");
  const [category, setCategory] = useState<Category>("all");
  const [scrolled, setScrolled] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const storyRef = useRef<HTMLElement>(null);
  const storyVideoRef = useRef<HTMLVideoElement>(null);
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
    let ticking = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      if (!ticking) {
        requestAnimationFrame(() => {
          const section = storyRef.current;
          if (section) {
            const rect = section.getBoundingClientRect();
            const distance = section.offsetHeight - window.innerHeight;
            const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, distance)));
            setStoryProgress(progress);
            const video = storyVideoRef.current;
            if (!reducedMotion.matches && video && Number.isFinite(video.duration)) {
              video.currentTime = progress * video.duration;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    const video = storyVideoRef.current;
    video?.addEventListener("loadedmetadata", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      video?.removeEventListener("loadedmetadata", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const shown = category === "all" ? items : items.filter((item) => item.category === category);
  const menuWipe = Math.max(0, Math.min(1, (storyProgress - .92) / .08));

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
        <div className="story-sticky">
          <div className="story-grid" aria-hidden="true" />
          <header className="story-intro" style={{ opacity: Math.max(0, 1-storyProgress*7), transform: `translateY(${storyProgress*-90}px)` }}>
            <p className="eyebrow"><span /> {t.open}</p>
            <h1>{t.headline[0]}<br />{t.headline[1]}</h1>
            <p>{t.intro}</p>
          </header>
          <div className="story-title ingredients-title" style={{ opacity: Math.max(0, Math.min(1,(storyProgress-.2)*7, (.72-storyProgress)*7)) }}>
            <p>{t.nothingHidden}</p><h2>{t.layerByLayer}</h2>
          </div>
          <div className="story-title finish-title" style={{ opacity: Math.max(0, Math.min(1,(storyProgress-.73)*8, (1-storyProgress)*8)) }}>
            <p>{t.simple}</p><h2>{t.inPlace}</h2>
          </div>
          <div className="story-halo" />
          <div className="story-burger" role="img" aria-label={t.burgerAria} style={{ transform: `translate(-50%,-50%) translateY(${storyProgress>.9?(storyProgress-.9)*1050:0}px)`, opacity: storyProgress>.97?Math.max(0,(1-storyProgress)*34):1 }}>
            <video ref={storyVideoRef} className="story-video" muted playsInline preload="auto" poster="/dinamo-burger-scroll-poster.jpg" aria-hidden="true">
              <source src="/dinamo-burger-scroll-premium.mp4" type="video/mp4" />
            </video>
            <img className="story-poster" src="/dinamo-burger-scroll-poster.jpg" alt="" aria-hidden="true" />
            {t.ingredientLabels.map((label,index) => {
              const reveal = Math.max(0,Math.min(1,(storyProgress-(.22+index*.035))*9, (.72-storyProgress)*8));
              return <div className={`ingredient-label label-${index+1}`} key={label[0]} style={{ opacity: reveal, transform: `translateY(-50%) translateX(${(1-reveal)*(index%2?18:-18)}px)` }}><span>0{index+1}</span><strong>{label[0]}</strong><p>{label[1]}</p></div>;
            })}
          </div>
          <div className="story-wipe" style={{ transform: `translateY(${(1-menuWipe)*100}%)` }}><span style={{ transform: `translateY(${(1-menuWipe)*80}px)`, opacity: menuWipe }}>{t.menu.toUpperCase()}</span></div>
          <div className="story-progress"><span style={{ height: `${storyProgress*100}%` }} /></div>
          <div className="story-phase"><strong>{storyProgress < .16 ? "01" : storyProgress < .69 ? "02" : "03"}</strong><span>/ 03</span></div>
          <p className="story-step">{storyProgress < .16 ? t.scrollOpen : storyProgress < .68 ? t.ingredientsStep : storyProgress < .9 ? t.assembling : t.menuBelow}</p>
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
          <div className="card-image"><img src={item.image} alt={item.name[lang]} loading="lazy" /><span>{t.categories[item.category]}</span></div>
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
