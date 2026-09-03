import { useEffect, useState } from "react";

import BurgerStory from "./components/BurgerStory";
import Footer from "./components/Footer";
import IceCreamStory from "./components/IceCreamStory";
import Location from "./components/Location";
import Menu from "./components/Menu";
import Nav from "./components/Nav";
import { translations, type Lang } from "./data/copy";

/** read once during initial state, so there is no setState inside an effect */
function savedLang(): Lang {
  try {
    const v = localStorage.getItem("dinamo-language");
    if (v === "bs" || v === "en") return v;
  } catch { /* private mode */ }
  return "bs";
}

export default function App() {
  const [lang, setLang] = useState<Lang>(savedLang);
  const copy = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dinamo-language", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      <Nav copy={copy} lang={lang} onLang={setLang} />
      <main>
        <BurgerStory copy={copy} />
        <IceCreamStory copy={copy} />
        <section className="ticker" aria-hidden="true">
          <div><span>{copy.ticker}</span><span>{copy.ticker}</span></div>
        </section>
        <Menu copy={copy} lang={lang} />
        <Location copy={copy} />
      </main>
      <Footer copy={copy} />
    </>
  );
}
