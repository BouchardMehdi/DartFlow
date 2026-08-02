"use client";

import { AnimatePresence, motion } from "motion/react";
import { Dartboard } from "@/components/dartboard/Dartboard";
import { createDart } from "@/src/game-engine/score-calculator";
import { useGameStore } from "@/src/stores/game-store";

const dartLabel = (score: number) => score === 0 ? "MISS" : String(score);

export function CountUpDemo() {
  const { history, throwDart, undo } = useGameStore();
  const game = history.present;
  const active = game.players[game.currentPlayerIndex];
  const winner = game.players.find((player) => player.id === game.winnerId);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-5 sm:px-7">
      <header className="mb-6 flex items-center justify-between border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[var(--lime)] text-xl font-black text-black">↗</span><div><p className="text-lg font-black tracking-[-.04em]">DARTFLOW</p><p className="text-[10px] uppercase tracking-[.24em] text-[var(--muted)]">Count‑Up local</p></div></div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">Manche {Math.min(game.currentRound, game.modeState.maxRounds)} / {game.modeState.maxRounds}</span>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(19rem,1fr)_minmax(22rem,1.15fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-5">
          <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime)]">Au lancer</p>
            <div className="flex items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-[-.05em]">{active?.name ?? "Partie terminée"}</h1><p className="mt-1 text-sm text-[var(--muted)]">Touchez directement la cible</p></div><motion.strong key={active?.id} initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl font-black tabular-nums">{active ? game.modeState.scores[active.id] ?? 0 : 0}</motion.strong></div>
            <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Fléchettes du tour">
              {[0, 1, 2].map((index) => <div key={index} className="grid h-14 place-items-center rounded-xl border border-[var(--line)] bg-black/20 text-lg font-black text-[var(--muted)]">{game.currentTurn.darts[index] ? dartLabel(game.currentTurn.darts[index].score) : `D${index + 1}`}</div>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {game.players.map((player, index) => <div key={player.id} className={`rounded-2xl border p-4 ${index === game.currentPlayerIndex && game.status === "in-progress" ? "border-[var(--lime)] bg-[var(--lime)]/5" : "border-[var(--line)] bg-[var(--panel)]"}`}><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: player.color }} /><span className="truncate text-sm font-bold">{player.name}</span></div><strong className="mt-2 block text-3xl tabular-nums">{game.modeState.scores[player.id] ?? 0}</strong></div>)}
          </div>

          <div className="grid grid-cols-2 gap-3"><button type="button" onClick={undo} disabled={history.past.length === 0} className="min-h-12 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 font-bold disabled:cursor-not-allowed disabled:opacity-35">↶ Annuler</button><button type="button" onClick={() => throwDart(createDart(null, 0, "miss"))} disabled={game.status !== "in-progress"} className="min-h-12 rounded-xl bg-[var(--ink)] px-4 font-black text-black disabled:opacity-35">Lancer manqué</button></div>
        </div>

        <div className="grid place-items-center rounded-[2rem] border border-[var(--line)] bg-[radial-gradient(circle,#222622_0%,#111311_68%)] p-3 sm:p-6"><Dartboard onThrow={throwDart} disabled={game.status !== "in-progress"} /></div>
      </section>

      <p className="sr-only" aria-live="polite">{active ? `${active.name}, score ${game.modeState.scores[active.id] ?? 0}` : ""}</p>
      <AnimatePresence>{winner && <motion.div className="fixed inset-0 z-20 grid place-items-center bg-black/80 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ y: 30, scale: .9 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-[2rem] border border-[var(--lime)] bg-[var(--panel)] p-8 text-center"><p className="text-sm font-black uppercase tracking-[.2em] text-[var(--lime)]">Victoire</p><h2 className="mt-3 text-4xl font-black">{winner.name}</h2><p className="mt-2 text-[var(--muted)]">{game.modeState.scores[winner.id]} points</p><button className="mt-6 min-h-12 w-full rounded-xl bg-[var(--lime)] font-black text-black" onClick={() => useGameStore.getState().start(game.players, game.modeState.maxRounds)}>Rejouer</button></motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}
