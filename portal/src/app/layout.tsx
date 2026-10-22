import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "@/components/ui/tokens.css";
import "./globals.css";
import "@/components/ui/ui.css";

const manrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-manrope",
});

// Brukes kun av forsiden (rollevelgeren).
const barlow = Barlow({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Trenerutdanning",
    template: "%s | Trenerutdanning",
  },
  description: "Læringsportal for trenerutdanningen i norsk golf.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${manrope.variable} ${barlow.variable} ${barlowCondensed.variable}`}
      data-scroll-behavior="smooth"
      lang="nb"
    >
      <body>
        <a className="nivaa-skip-link" href="#main-content">
          Hopp til hovedinnhold
        </a>
        {children}
      </body>
    </html>
  );
}
