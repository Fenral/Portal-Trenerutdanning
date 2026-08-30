import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "@/components/ui/tokens.css";
import "./globals.css";
import "@/components/ui/ui.css";

const manrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-manrope",
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
    <html className={manrope.variable} data-scroll-behavior="smooth" lang="nb">
      <body>
        <a className="nivaa-skip-link" href="#main-content">
          Hopp til hovedinnhold
        </a>
        {children}
      </body>
    </html>
  );
}
