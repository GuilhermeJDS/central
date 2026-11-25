import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import "./globals.css";

/* Fontes servidas do próprio projeto (public/fonts): nada de Google Fonts.
   Cada família é um arquivo variável só (um download por família). */
const bricolage = localFont({
  src: "../../public/fonts/bricolage-grotesque/800-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});
const sourceSans = localFont({
  src: "../../public/fonts/source-sans-3/400-normal.woff2",
  weight: "200 900",
  variable: "--font-source-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "../../public/fonts/geist-mono/400-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Central", template: "%s · Central" },
  description: "A sua empresa tocada por uma equipe de agentes de IA.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${sourceSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
