import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";
import { CloudProvider } from "@/components/cloud/CloudProvider";
import { SiteNavigation } from "@/components/layout/SiteNavigation";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";

export const metadata: Metadata = {
  title: "DartFlow — Compteur de fléchettes",
  description:
    "Comptez vos points de fléchettes, simplement et sans connexion.",
  icons: {
    icon: [
      { url: "/icons/dartflow-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/dartflow-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icons/dartflow-192.png",
    apple: { url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
  },
  applicationName: "DartFlow",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DartFlow",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0f0e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <SerwistProvider swUrl="/serwist/sw.js">
          <CloudProvider>
            <RealtimeProvider>
              <SiteNavigation />
              {children}
            </RealtimeProvider>
          </CloudProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
