"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { countUpConfigSchema, x01ConfigSchema } from "@/src/database/schemas";
import type { Player, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";
import { useGameStore } from "@/src/stores/game-store";

const COLORS = ["#c8f03d", "#ff6b35", "#57b8ff", "#f25f8b", "#b99cff", "#45d6a8", "#ffd166", "#f28f3b"];
const makePlayer = (index: number): Player => ({ id: crypto.randomUUID(), name: `Joueur ${index + 1}`, color: COLORS[index] ?? "#c8f03d", order: index });

function shuffled(players: Player[]): Player[] {
  const result = [...players];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = result[index]; const other = result[target];
    if (current && other) { result[index] = other; result[target] = current; }
  }
  return result.map((player, order) => ({ ...player, order }));
}

export function NewGameForm() {
  const router = useRouter();
  const start = useGameStore((store) => store.start);
  const startX01 = useGameStore((store) => store.startX01);
  const [mode, setMode] = useState<"count-up" | "301" | "501" | "701">("count-up");
  const [players, setPlayers] = useState<Player[]>(() => [makePlayer(0), makePlayer(1)]);
  const [rounds, setRounds] = useState<number | null>(8);
  const [randomOrder, setRandomOrder] = useState(false);
  const [entryRule, setEntryRule] = useState<X01EntryRule>("straight");
  const [exitRule, setExitRule] = useState<X01ExitRule>("double");
  const validation = useMemo(() => mode === "count-up"
    ? countUpConfigSchema.safeParse({ players, rounds })
    : x01ConfigSchema.safeParse({ players, startingScore: Number(mode), entryRule, exitRule, rounds }), [players, rounds, mode, entryRule, exitRule]);

  const setPlayerCount = (count: number) => {
    setPlayers((current) => count > current.length
      ? [...current, ...Array.from({ length: count - current.length }, (_, index) => makePlayer(current.length + index))]
      : current.slice(0, count));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.success) return;
    const ordered = randomOrder ? shuffled(players) : players.map((player, order) => ({ ...player, order }));
    if (mode === "count-up") start(ordered, rounds ?? 8);
    else startX01(ordered, Number(mode) as 301 | 501 | 701, entryRule, exitRule, rounds);
    router.push("/game");
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-5 sm:px-7">
      <header className="mb-8 flex items-center justify-between border-b border-[var(--line)] pb-4">
        <Link href="/" className="font-bold text-[var(--muted)] hover:text-white">← Accueil</Link>
        <span className="text-sm font-black tracking-[.14em]">NOUVELLE PARTIE</span>
      </header>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
            <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">01 · Mode de jeu</span>
            <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Mode</span><select value={mode} onChange={(event) => { const nextMode = event.target.value as typeof mode; setMode(nextMode); if (nextMode === "count-up" && rounds === null) setRounds(8); }} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold"><option value="count-up">Count‑Up</option><option value="301">301</option><option value="501">501</option><option value="701">701</option><option disabled>Around the Clock — bientôt</option></select></label>
            <div className="mt-4 rounded-xl bg-black/20 p-4"><p className="font-bold">{mode === "count-up" ? "Le plus gros score gagne" : `Atteignez exactement zéro depuis ${mode}`}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{mode === "count-up" ? "Chaque joueur lance trois fléchettes par manche. Tous les points sont additionnés." : "Un dépassement ou une sortie invalide provoque un bust et annule le tour."}</p></div>
          </section>

          <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
            <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">02 · Règles</span>
            <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Nombre de manches</span><select value={rounds ?? "infinite"} onChange={(event) => setRounds(event.target.value === "infinite" ? null : Number(event.target.value))} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold">{[5, 8, 10, 15, 20].map((value) => <option key={value} value={value}>{value} manches</option>)}{mode !== "count-up" && <option value="infinite">Infini — jusqu’au checkout</option>}</select></label>
            {mode !== "count-up" && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Entrée</span><select value={entryRule} onChange={(event) => setEntryRule(event.target.value as X01EntryRule)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-3 font-bold"><option value="straight">Straight in</option><option value="double">Double in</option><option value="master">Master in</option></select></label><label><span className="mb-2 block text-sm font-bold">Sortie</span><select value={exitRule} onChange={(event) => setExitRule(event.target.value as X01ExitRule)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-3 font-bold"><option value="straight">Straight out</option><option value="double">Double out</option><option value="master">Master out</option></select></label></div>}
          </section>
        </div>

        <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
          <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">03 · Joueurs</span>
          <div className="mt-4 flex items-center justify-between"><div><p className="font-bold">Nombre de joueurs</p><p className="text-sm text-[var(--muted)]">De 1 à 8 sur cet appareil</p></div><div className="flex items-center gap-3"><button type="button" aria-label="Retirer un joueur" disabled={players.length === 1} onClick={() => setPlayerCount(players.length - 1)} className="grid size-11 place-items-center rounded-xl border border-[var(--line)] text-xl disabled:opacity-30">−</button><strong className="w-5 text-center text-xl">{players.length}</strong><button type="button" aria-label="Ajouter un joueur" disabled={players.length === 8} onClick={() => setPlayerCount(players.length + 1)} className="grid size-11 place-items-center rounded-xl border border-[var(--line)] text-xl disabled:opacity-30">+</button></div></div>

          <div className="mt-5 space-y-3">{players.map((player, index) => <label key={player.id} className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-black text-black" style={{ background: player.color }}>{index + 1}</span><span className="sr-only">Pseudo du joueur {index + 1}</span><input value={player.name} maxLength={40} onChange={(event) => setPlayers((current) => current.map((item) => item.id === player.id ? { ...item, name: event.target.value } : item))} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold" /></label>)}</div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] p-4"><input type="checkbox" checked={randomOrder} onChange={(event) => setRandomOrder(event.target.checked)} className="mt-1 size-5 accent-[var(--lime)]" /><span><strong className="block">Ordre de passage aléatoire</strong><span className="mt-1 block text-sm text-[var(--muted)]">Les joueurs seront mélangés au démarrage de la partie.</span></span></label>

          {!validation.success && <p role="alert" className="mt-4 text-sm font-bold text-[#ff8b65]">Chaque joueur doit avoir un pseudo.</p>}
          <button type="submit" disabled={!validation.success} className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--lime)] px-6 font-black text-black disabled:cursor-not-allowed disabled:opacity-35">Démarrer la partie →</button>
        </section>
      </form>
    </main>
  );
}
