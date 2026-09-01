export type Category = "burgers" | "ice" | "drinks";

export type Item = {
  category: Category;
  name: { bs: string; en: string };
  price: string;
  note?: string;
  image: string;
};

export const items: readonly Item[] = [
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
];

export const PHONE = "063553739";
export const INSTAGRAM = "https://www.instagram.com/slasticarnadinamo";
