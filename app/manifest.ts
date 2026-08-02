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
      { src: "/icons/dartflow.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/dartflow-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
