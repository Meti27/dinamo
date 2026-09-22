import { useEffect, useState } from "react";

import BurgerStory from "./components/BurgerStory";
import Footer from "./components/Footer";
import IceCreamStory from "./components/IceCreamStory";
import Location from "./components/Location";
import Menu from "./components/Menu";
import Nav from "./components/Nav";
import Preloader from "./components/Preloader";
import { prefersReducedMotion } from "./sequence/prefersReducedMotion";
import { BURGER_FRAMES } from "./sequence/sequences";
import { useBoot } from "./sequence/useBoot";
import { useFrameLoader } from "./sequence/useFrameLoader";
import { translations, type Lang } from "./data/copy";

/**
 * The burger frames are loaded here rather than inside BurgerStory, because
 * they are what the preloader is waiting for: they are the first thing on the
 * screen. The gate is frame 0, not the whole sequence — see useBoot. The ice
 * cream sequence still loads itself, later and on its own terms.
 */

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

  const reduced = prefersReducedMotion;
  const burger = useFrameLoader(!reduced, BURGER_FRAMES);
  // "settled" rather than "ready": a device with no AVIF support resolves to
  // `unsupported` and shows the stills, which is a finished boot too
  const firstFrameSettled = reduced || burger.status !== "waiting";
  const boot = useBoot(firstFrameSettled);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dinamo-language", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      {!boot.dismissed && (
        <Preloader
          progress={burger.status === "ready" ? 1 : burger.progress}
          label={copy.loading}
          done={boot.ready}
        />
      )}
      <Nav copy={copy} lang={lang} onLang={setLang} />
      <main>
        <BurgerStory copy={copy} load={burger} />
        <IceCreamStory copy={copy} booted={boot.dismissed} />
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
