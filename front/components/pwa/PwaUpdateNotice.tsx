"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveGame } from "@/src/database/repositories/game-repository";
import { useGameStore } from "@/src/stores/game-store";

const CHECK_INTERVAL = 5 * 60_000;
const ACTIVATION_TIMEOUT = 15_000;

export function PwaUpdateNotice() {
  const pathname = usePathname();
  const hasStarted = useGameStore((state) => state.hasStarted);
  const gameStatus = useGameStore((state) => state.history.present.status);
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const activated = useRef(false);
  const applying = useRef(false);
  const requested = useRef(false);
  const reloading = useRef(false);
  const activationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let stopped = false;
    let checking = false;
    let lastCheck = -Infinity;
    let controller = navigator.serviceWorker.controller;
    let lastWaiting: ServiceWorker | null = null;
    const workers = new Set<ServiceWorker>();
    const announce = () => {
      const waiting = registration.current?.waiting;
      if (!waiting || waiting === lastWaiting) return;
      lastWaiting = waiting;
      setAvailable(true);
      setDismissed(false);
      setError("");
    };
    const stateChanged = () => { if (!stopped) announce(); };
    const watchInstalling = () => {
      const worker = registration.current?.installing;
      if (!worker || workers.has(worker)) return;
      workers.add(worker);
      worker.addEventListener("statechange", stateChanged);
    };
    const controllerChanged = () => {
      const previous = controller;
      controller = navigator.serviceWorker.controller;
      // The first installation is not an application update.
      if (!previous || !controller || previous === controller) return;
      activated.current = true;
      if (requested.current && !reloading.current) {
        reloading.current = true;
        clearTimeout(activationTimer.current);
        location.reload();
      } else {
        // Another tab may accept the update. This tab still chooses when to reload.
        setAvailable(true);
      }
    };
    const check = async () => {
      setOnline(navigator.onLine);
      if (stopped || !navigator.onLine || document.visibilityState === "hidden") return;
      const current = registration.current;
      if (!current) return;
      announce();
      if (checking || Date.now() - lastCheck < 60_000) return;
      checking = true;
      lastCheck = Date.now();
      try { await current.update(); } catch { /* A failed background check can wait for the next connection. */ }
      finally { checking = false; }
    };
    const wake = () => { void check(); };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    window.addEventListener("online", wake);
    window.addEventListener("offline", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    const interval = setInterval(wake, CHECK_INTERVAL);
    void navigator.serviceWorker.ready.then((current) => {
      if (stopped) return;
      registration.current = current;
      current.addEventListener("updatefound", watchInstalling);
      watchInstalling();
      announce();
      void check();
    }).catch(() => { /* Service workers may be unavailable in restricted browsers. */ });
    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(activationTimer.current);
      registration.current?.removeEventListener("updatefound", watchInstalling);
      for (const worker of workers) worker.removeEventListener("statechange", stateChanged);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  const applyUpdate = async () => {
    if (applying.current || !navigator.onLine) return;
    applying.current = true;
    setUpdating(true);
    setError("");
    try {
      const store = useGameStore.getState();
      if (store.hasStarted) await saveGame(store.history.present);
      if (activated.current) {
        if (!reloading.current) { reloading.current = true; location.reload(); }
        return;
      }
      const waiting = registration.current?.waiting;
      if (!waiting) throw new Error("Update unavailable");
      requested.current = true;
      activationTimer.current = setTimeout(() => {
        applying.current = false;
        requested.current = false;
        setUpdating(false);
        setError("La mise à jour n’a pas abouti. Tu peux réessayer.");
      }, ACTIVATION_TIMEOUT);
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      clearTimeout(activationTimer.current);
      applying.current = false;
      requested.current = false;
      setUpdating(false);
      setError("Impossible d’actualiser pour le moment. Réessaie dans un instant.");
    }
  };

  // Wait until gameplay ends or the player leaves the scoring screen.
  const playing = pathname === "/game" && (!hasStarted || !["completed", "cancelled"].includes(gameStatus));
  if (!available || dismissed || playing) return null;

  return (
    <aside aria-label="Mise à jour de l’application" className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-[var(--lime)]/40 bg-[#171918] p-4 shadow-2xl shadow-black/60 sm:inset-x-auto sm:right-5 sm:w-96">
      <p role="status" className="text-sm font-black">Nouvelle version disponible</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Actualise DartFlow pour profiter des nouveautés.</p>
      {!online && <p className="mt-2 text-xs text-[var(--muted)]">Reconnecte-toi à Internet pour actualiser.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-[#ff9b7a]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void applyUpdate()} disabled={updating || !online} className="min-h-11 flex-1 rounded-xl bg-[var(--lime)] px-3 py-2 text-sm font-black text-black disabled:opacity-50">
          {updating ? "Actualisation…" : "Actualiser"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} disabled={updating} className="min-h-11 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold disabled:opacity-50">Plus tard</button>
      </div>
    </aside>
  );
}
