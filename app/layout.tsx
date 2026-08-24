import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dinamo — Hamburgeri i Sladoled",
  description: "Burgeri, sladoled i osvježenje u srcu Orašja. Otvoreno svaki dan od 08:00 do 23:00.",
  openGraph: {
    title: "Dinamo — Hamburgeri i Sladoled",
    description: "Glad ne čeka. Vidimo se u Dinamu, Orašje.",
    type: "website",
    url: "https://dinamo-orasje.metushaga27.chatgpt.site",
    images: [{ url: "https://dinamo-orasje.metushaga27.chatgpt.site/og.jpg", width: 1200, height: 630, alt: "Dinamo hamburgeri i sladoled u Orašju" }],
  },
  twitter: { card: "summary_large_image", title: "Dinamo — Hamburgeri i Sladoled", description: "Glad ne čeka. Vidimo se u Dinamu, Orašje.", images: ["https://dinamo-orasje.metushaga27.chatgpt.site/og.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bs"><body>{children}</body></html>;
}
