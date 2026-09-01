import { useState } from "react";

import { items, type Category } from "../data/menu";
import type { Copy, Lang } from "../data/copy";

type Filter = "all" | Category;
const filters: readonly Filter[] = ["all", "burgers", "ice", "drinks"];

export default function Menu({ copy, lang }: { copy: Copy; lang: Lang }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <section className="menu" id="menu">
      <div className="menu-head">
        <div>
          <p className="kicker">{copy.choose}</p>
          <h2>{copy.ourMenu}</h2>
        </div>
        <div className="filters" role="group" aria-label={copy.filterLabel}>
          {filters.map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {copy.categories[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-grid">
        {shown.map((item, index) => (
          <article className="card" key={item.name.bs} style={{ "--i": index } as React.CSSProperties}>
            <div className="card-image">
              <img src={item.image} alt={item.name[lang]} width={520} height={520}
                loading="lazy" decoding="async" />
              <span>{copy.categories[item.category]}</span>
            </div>
            <div className="card-info">
              <div>
                <h3>{item.name[lang]}</h3>
                {item.note && <p>{item.note}</p>}
              </div>
              <strong>{item.price}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
