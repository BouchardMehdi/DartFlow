"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInBrowser, setShowInBrowser] = useState(false);
  useEffect(() => {
    if (isStandalone()) return;
    const frame = window.requestAnimationFrame(() => setShowInBrowser(true));
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as BeforeInstallPromptEvent); };
    const installed = () => { setPromptEvent(null); setShowInBrowser(false); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (!showInBrowser) return null;
  const install = async () => {
    if (!promptEvent) { window.alert("Pour installer DartFlow, ouvrez le menu de votre navigateur puis choisissez « Ajouter à l’écran d’accueil » ou « Installer l’application »."); return; }
    await promptEvent.prompt(); const choice = await promptEvent.userChoice; if (choice.outcome === "accepted") setPromptEvent(null);
  };
  return <button type="button" onClick={() => void install()} className="grid min-h-14 place-items-center rounded-2xl border border-[var(--lime)] px-7 font-black text-[var(--lime)] hover:bg-[var(--lime)]/10">Installer l’application</button>;
}
