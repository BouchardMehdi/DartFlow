import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DartFlow — Compteur de fléchettes",
    short_name: "DartFlow",
    description: "Comptez vos points de fléchettes, simplement et hors ligne.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0f0e",
    theme_color: "#c8f03d",
    categories: ["games", "sports", "utilities"],
    lang: "fr",
    icons: [
      { src: "/icons/dartflow-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/dartflow-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/dartflow-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
