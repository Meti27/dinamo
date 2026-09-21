import { useEffect, useState } from "react";

import BurgerStory from "./components/BurgerStory";
import Footer from "./components/Footer";
import IceCreamStory from "./components/IceCreamStory";
import Location from "./components/Location";
import Menu from "./components/Menu";
import Nav from "./components/Nav";
import Preloader from "./components/Preloader";
import { DESKTOP_COUNT, MOBILE_COUNT } from "./frames";
import { prefersReducedMotion } from "./sequence/prefersReducedMotion";
import { useBoot } from "./sequence/useBoot";
import { useFrameLoader, type FrameSource } from "./sequence/useFrameLoader";
import { translations, type Lang } from "./data/copy";

/**
 * The burger frames are loaded here rather than inside BurgerStory, because
 * they are what the preloader is waiting for: they are the first thing on the
 * screen, and the page stays locked until they are decoded. The ice cream
 * sequence still loads itself, later and on its own terms — see IceCreamStory.
 */
const BURGER_FRAMES: FrameSource = {
  dir: "frames",
  desktopCount: DESKTOP_COUNT,
  mobileCount: MOBILE_COUNT,
};

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
  const framesSettled = reduced || burger.status !== "loading";
  const boot = useBoot(framesSettled);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dinamo-language", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      {!boot.dismissed && (
        <Preloader
          progress={burger.status === "loading" ? burger.progress : 1}
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
