"use client";

import { useEffect, useState } from "react";

import ScrollStory from "./ScrollStory";

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
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("dinamo-language", lang);
  }, [lang]);

  useEffect(() => {
    const saved = localStorage.getItem("dinamo-language");
    if (saved === "en" || saved === "bs") setLang(saved);
  }, []);

  // the nav restyles once the page has moved; the story drives itself
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const shown = category === "all" ? items : items.filter((item) => item.category === category);
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

      <ScrollStory copy={t} />

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
