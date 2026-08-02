"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUpDemo } from "@/components/game/CountUpDemo";
import { loadResumableGame } from "@/src/database/repositories/game-repository";
import { useGameStore } from "@/src/stores/game-store";

export function GameSession() {
  const hasStarted = useGameStore((state) => state.hasStarted);
  const restore = useGameStore((state) => state.restore);
  const [loading, setLoading] = useState(!hasStarted);

  useEffect(() => {
    if (hasStarted) return;
    let active = true;
    void loadResumableGame().then((game) => { if (!active) return; if (game) restore(game); setLoading(false); }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hasStarted, restore]);

  if (loading) return <main className="grid min-h-screen place-items-center p-6"><p className="font-bold text-[var(--muted)]">Restauration de la partie…</p></main>;
  if (!hasStarted) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-3xl font-black">Aucune partie en cours</h1><p className="mt-3 text-[var(--muted)]">Créez une nouvelle partie pour commencer à jouer.</p><Link href="/new-game" className="mt-6 grid min-h-12 place-items-center rounded-xl bg-[var(--lime)] px-5 font-black text-black">Nouvelle partie</Link></div></main>;
  return <CountUpDemo />;
}
