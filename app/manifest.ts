import type { MetadataRoute } from "next";

// Manifest de la PWA: permite "Agregar a pantalla de inicio" desde el navegador
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NutriTrack — Tu dieta, sin suscripciones",
    short_name: "NutriTrack",
    description: "Registra comidas por foto con IA y sigue tus calorías y macros.",
    lang: "es",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#2f9e44",
    categories: ["health", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Registrar por foto", url: "/log?mode=photo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
