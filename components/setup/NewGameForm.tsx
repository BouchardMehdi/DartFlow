"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { countUpConfigSchema } from "@/src/database/schemas";
import type { Player } from "@/src/game-engine/types";
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
  const [players, setPlayers] = useState<Player[]>(() => [makePlayer(0), makePlayer(1)]);
  const [rounds, setRounds] = useState(8);
  const [randomOrder, setRandomOrder] = useState(false);
  const validation = useMemo(() => countUpConfigSchema.safeParse({ players, rounds }), [players, rounds]);

  const setPlayerCount = (count: number) => {
    setPlayers((current) => count > current.length
      ? [...current, ...Array.from({ length: count - current.length }, (_, index) => makePlayer(current.length + index))]
      : current.slice(0, count));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.success) return;
    const ordered = randomOrder ? shuffled(players) : players.map((player, order) => ({ ...player, order }));
    start(ordered, rounds);
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
            <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Mode</span><select className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold" defaultValue="count-up"><option value="count-up">Count‑Up</option><option disabled>301 — bientôt</option><option disabled>501 — bientôt</option><option disabled>Around the Clock — bientôt</option></select></label>
            <div className="mt-4 rounded-xl bg-black/20 p-4"><p className="font-bold">Le plus gros score gagne</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Chaque joueur lance trois fléchettes par manche. Tous les points sont additionnés.</p></div>
          </section>

          <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
            <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">02 · Règles</span>
            <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Nombre de manches</span><select value={rounds} onChange={(event) => setRounds(Number(event.target.value))} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold">{[5, 8, 10, 15, 20].map((value) => <option key={value} value={value}>{value} manches</option>)}</select></label>
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
