import { useEffect, useState } from "react";

import Logo from "./Logo";
import { PHONE } from "../data/menu";
import type { Copy, Lang } from "../data/copy";

export default function Nav({ copy, lang, onLang }: {
  copy: Copy; lang: Lang; onLang: (l: Lang) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={scrolled ? "nav scrolled" : "nav"}>
      <a className="brand" href="#top" aria-label="Dinamo">
        <Logo size={44} />
        <span>DINAMO</span>
      </a>
      <div className="nav-links">
        <a href="#menu">{copy.menu}</a>
        <a href="#lokacija">{copy.location}</a>
      </div>
      <div className="nav-actions">
        <div className="lang" role="group" aria-label="Language">
          {(["bs", "en"] as const).map((l) => (
            <button key={l} className={lang === l ? "active" : ""}
              onClick={() => onLang(l)} aria-pressed={lang === l}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <a className="nav-call" href={`tel:${PHONE}`}>{copy.call}</a>
      </div>
    </nav>
  );
}
