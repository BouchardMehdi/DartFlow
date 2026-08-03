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
    icon: "/icons/dartflow.svg",
    shortcut: "/icons/dartflow.svg",
    apple: "/icons/dartflow.svg",
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
