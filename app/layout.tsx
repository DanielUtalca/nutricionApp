import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/client-providers";

const inter = Inter({
  subsets: ["latin"],
  // Cargamos los pesos que más usaremos: texto normal, semibold y bold
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NutriTrack — Tu dieta, sin suscripciones",
  description:
    "App de nutrición personal: registra comidas por foto con IA, sigue tus macros y alcanza tus metas sin pagar suscripciones.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.className} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
