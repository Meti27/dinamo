import Logo from "./Logo";
import { INSTAGRAM, PHONE } from "../data/menu";
import type { Copy } from "../data/copy";

export default function Location({ copy }: { copy: Copy }) {
  return (
    <section className="location" id="lokacija">
      <div className="location-copy">
        <p className="kicker gold">{copy.where}</p>
        <h2>{copy.seeYou[0]}<br />{copy.seeYou[1]}</h2>
        <p className="address">{copy.address[0]}<br />{copy.address[1]}</p>
        <div className="hours">
          <span>{copy.everyDay}</span>
          <strong>08:00 — 23:00</strong>
        </div>
        <div className="location-actions">
          <a className="button primary" href={`tel:${PHONE}`}>{copy.callUs}</a>
          <a className="button ghost" href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram ↗</a>
        </div>
      </div>
      <div className="logo-panel">
        <div className="logo-mark">
          <span className="logo-glow" aria-hidden="true" />
          <Logo size={220} />
        </div>
        <p>{copy.logoLine}</p>
      </div>
    </section>
  );
}
