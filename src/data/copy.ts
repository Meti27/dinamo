export type Lang = "bs" | "en";

/**
 * The five ingredient labels are matched to what the footage actually shows.
 *
 * The burger's outline narrows into six masses — top bun, onion, tomato, cheese
 * fused to the patty, lettuce, bottom bun — and the onion and tomato share a
 * label, which makes five. There is no pickle or sauce layer in this burger, and
 * the cheddar never separates from the patty, so the old "Dinamo sos" and a
 * standalone cheddar label would both point at something that is not there.
 */
export type Copy = {
  menu: string; location: string; call: string; open: string;
  headline: readonly [string, string];
  intro: string;
  nothingHidden: string; layerByLayer: string;
  simple: string; inPlace: string;
  scrollOpen: string; ingredientsStep: string; assembling: string; menuBelow: string;
  loading: string; ticker: string;
  choose: string; ourMenu: string; filterLabel: string;
  where: string; seeYou: readonly [string, string];
  address: readonly [string, string];
  everyDay: string; callUs: string; backTop: string;
  logoLine: string; rights: string;
  categories: { all: string; burgers: string; ice: string; drinks: string };
  /** five [title, description] pairs, top to bottom — see the note above */
  ingredientLabels: readonly (readonly [string, string])[];
  burgerAria: string;
};

const bs: Copy = {
  menu: "Meni", location: "Lokacija", call: "Pozovi",
  open: "Orašje · od 08 do 23h",
  headline: ["Glad ne", "čeka."],
  intro: "Skrolaj i upoznaj naš burger.",
  nothingHidden: "NIŠTA NE KRIJEMO",
  layerByLayer: "Sloj po sloj.",
  simple: "JEDNOSTAVNO. SVJEŽE. UKUSNO.",
  inPlace: "Sve na svom mjestu.",
  scrollOpen: "SKROLAJ DA OTVORIŠ BURGER",
  ingredientsStep: "NAŠI SASTOJCI",
  assembling: "SASTAVLJAMO",
  menuBelow: "MENI JE ISPOD",
  loading: "UČITAVANJE",
  ticker: "BURGERI ✦ SLADOLED ✦ DOBAR OSJEĆAJ ✦ BURGERI ✦ SLADOLED ✦",
  choose: "IZABERI SVOJ FAVORIT", ourMenu: "Naš meni", filterLabel: "Filtriraj meni",
  where: "GDJE SMO?", seeYou: ["Vidimo se", "u Dinamu."],
  address: ["Donja Mahala, Ulica Školska 18", "Orašje, Bosna i Hercegovina"],
  everyDay: "SVAKI DAN", callUs: "Pozovi nas", backTop: "NA VRH ↑",
  logoLine: "HAMBURGERI · SLADOLED · ORAŠJE",
  rights: "© 2026 Dinamo Orašje",
  categories: { all: "Sve", burgers: "Burgeri", ice: "Sladoled", drinks: "Pića" },
  ingredientLabels: [
    ["Brioche pecivo", "Mekano, zlatno i uvijek svježe."],
    ["Paradajz i crveni luk", "Svježe narezano svako jutro."],
    ["100% goveđe meso", "Sa topljenim cheddarom, pečeno na grilu."],
    ["Hrskava salata", "Ubrana, oprana i uvijek zelena."],
    ["Tostirano pecivo", "Čvrsta baza za burger bez kompromisa."],
  ],
  burgerAria: "Dinamo burger koji se rastavlja na svoje sastojke i ponovo sastavlja",
};

const en: Copy = {
  menu: "Menu", location: "Location", call: "Call us",
  open: "Orašje · open 8am–11pm",
  headline: ["Hunger", "won’t wait."],
  intro: "Scroll to discover our burger.",
  nothingHidden: "NOTHING TO HIDE",
  layerByLayer: "Layer by layer.",
  simple: "SIMPLE. FRESH. DELICIOUS.",
  inPlace: "Everything in place.",
  scrollOpen: "SCROLL TO OPEN THE BURGER",
  ingredientsStep: "OUR INGREDIENTS",
  assembling: "PUTTING IT BACK",
  menuBelow: "THE MENU IS BELOW",
  loading: "LOADING",
  ticker: "BURGERS ✦ ICE CREAM ✦ GOOD VIBES ✦ BURGERS ✦ ICE CREAM ✦",
  choose: "CHOOSE YOUR FAVORITE", ourMenu: "Our menu", filterLabel: "Filter menu",
  where: "FIND US", seeYou: ["See you", "at Dinamo."],
  address: ["Donja Mahala, Ulica Školska 18", "Orašje, Bosnia and Herzegovina"],
  everyDay: "EVERY DAY", callUs: "Call us", backTop: "BACK TO TOP ↑",
  logoLine: "BURGERS · ICE CREAM · ORAŠJE",
  rights: "© 2026 Dinamo Orašje",
  categories: { all: "All", burgers: "Burgers", ice: "Ice cream", drinks: "Drinks" },
  ingredientLabels: [
    ["Brioche bun", "Soft, golden and always fresh."],
    ["Tomato & red onion", "Sliced fresh every morning."],
    ["100% beef", "With melted cheddar, flame-grilled."],
    ["Crisp lettuce", "Picked, washed and always green."],
    ["Toasted bun", "A solid base for a no-compromise burger."],
  ],
  burgerAria: "The Dinamo burger separating into its ingredients and coming back together",
};

export const translations: Record<Lang, Copy> = { bs, en };
