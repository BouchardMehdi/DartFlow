"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadResumableGame } from "@/src/database/repositories/game-repository";
import type { GameState } from "@/src/game-engine/types";
import { useGameStore } from "@/src/stores/game-store";

export function ResumeGameCard() {
  const router = useRouter();
  const restore = useGameStore((state) => state.restore);
  const [game, setGame] = useState<GameState | null>(null);
  useEffect(() => { let active = true; void loadResumableGame().then((saved) => { if (active) setGame(saved); }).catch(() => undefined); return () => { active = false; }; }, []);
  if (!game) return null;
  const mode = game.modeState.kind === "count-up" ? "Count‑Up" : game.modeState.kind === "x01" ? String(game.modeState.startingScore) : "Around the Clock";
  return <button type="button" onClick={() => { restore(game); router.push("/game"); }} className="mt-4 flex w-full max-w-xl items-center justify-between rounded-2xl border border-[var(--lime)]/50 bg-[var(--lime)]/5 p-4 text-left hover:bg-[var(--lime)]/10"><span><strong className="block">Reprendre la partie</strong><span className="mt-1 block text-sm text-[var(--muted)]">{mode} · Manche {game.currentRound} · {game.players.length} joueur{game.players.length > 1 ? "s" : ""}</span></span><span className="text-2xl text-[var(--lime)]">→</span></button>;
}
