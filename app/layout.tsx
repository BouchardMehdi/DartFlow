import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DartFlow — Compteur de fléchettes",
  description: "Comptez vos points de fléchettes, simplement et sans connexion.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
