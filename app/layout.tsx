import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/client-providers";

const inter = Inter({
  subsets: ["latin"],
  // Cargamos los pesos que más usaremos: texto normal, semibold y bold
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NutriTrack — Tu dieta, sin suscripciones",
  description:
    "App de nutrición personal: registra comidas por foto con IA, sigue tus macros y alcanza tus metas sin pagar suscripciones.",
  applicationName: "NutriTrack",
  appleWebApp: { capable: true, title: "NutriTrack", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${inter.className} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
