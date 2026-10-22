"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ScoreInput } from "@/components/game/ScoreInput";
import { TurnHistory } from "@/components/game/TurnHistory";
import { FinalResults } from "@/components/game/FinalResults";
import { CricketScoreboard } from "@/components/game/CricketScoreboard";
import { KillerScoreboard } from "@/components/game/KillerScoreboard";
import { GameRulesPanel } from "@/components/game/GameRulesPanel";
import { AnimationOverlay } from "@/components/animations/AnimationOverlay";
import { suggestCheckouts } from "@/src/game-engine/checkouts/checkout-service";
import { createDart } from "@/src/game-engine/score-calculator";
import { useGameStore } from "@/src/stores/game-store";

const dartLabel = (score: number) => score === 0 ? "MISS" : String(score);

export function CountUpDemo() {
  const [showCheckoutAlternatives, setShowCheckoutAlternatives] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const router = useRouter();
  const { history, throwDart, undo, abandon } = useGameStore();
  const game = history.present;
  const modeState = game.modeState;
  const active = game.players[game.currentPlayerIndex];
  const winner = game.players.find((player) => player.id === game.winnerId);
  const isCountUp = game.modeState.kind === "count-up";
  const playerScore = useCallback((playerId: string) => modeState.kind === "count-up" || modeState.kind === "shanghai" ? modeState.scores[playerId] ?? 0 : modeState.kind === "x01" || modeState.kind === "cricket" ? modeState.players[playerId]?.score ?? 0 : modeState.kind === "killer" ? modeState.players[playerId]?.lives ?? 0 : modeState.kind === "training" ? modeState.score : modeState.players[playerId]?.target ?? 1, [modeState]);
  const checkoutRoutes = useMemo(() => !active ? [] : modeState.kind === "x01" ? suggestCheckouts(playerScore(active.id), 3 - game.currentTurn.darts.length, modeState.exitRule, modeState.entryRule, modeState.players[active.id]?.hasEntered ?? false) : modeState.kind === "training" && modeState.trainingType === "checkout" && modeState.remaining ? suggestCheckouts(modeState.remaining, 3 - game.currentTurn.darts.length, "double") : [], [active, modeState, game.currentTurn.darts.length, playerScore]);
  const checkout = checkoutRoutes[0];
  const trainingLabel = modeState.kind === "training" ? modeState.trainingType === "doubles" ? "Entraînement doubles" : modeState.trainingType === "triples" ? "Entraînement triples" : modeState.trainingType === "checkout" ? "Checkout Challenge" : modeState.trainingType === "bobs-27" ? "Bob’s 27" : "Cible aléatoire" : null;
  const trainingTarget = modeState.kind === "training" ? modeState.trainingType === "checkout" ? String(modeState.remaining ?? "—") : modeState.target?.label ?? "—" : null;
  const closeRules = useCallback(() => setShowRules(false), []);
  const confirmAbandon = () => {
    if (!window.confirm("Abandonner cette partie ? La progression en cours sera perdue.")) return;
    abandon();
    router.push("/");
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pt-5">
      <header className="mb-4 flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-xl font-black text-black">↗</span><div className="min-w-0"><p className="text-lg font-black tracking-[-.04em]">DARTFLOW</p><p className="text-[10px] uppercase tracking-[.24em] text-[var(--muted)]">{game.clubName ? `${game.clubName} · ` : ""}{modeState.kind === "count-up" ? "Count‑Up" : modeState.kind === "x01" ? `${modeState.startingScore} · ${modeState.exitRule} out · ${modeState.legsToWin}L/${modeState.setsToWin}S` : modeState.kind === "around-the-clock" ? "Around the Clock" : modeState.kind === "shanghai" ? "Shanghai" : modeState.kind === "cricket" ? modeState.variant === "standard" ? "Cricket standard" : modeState.variant === "no-score" ? "Cricket sans points" : "Cut-Throat Cricket" : modeState.kind === "training" ? trainingLabel : "Killer"}</p></div></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">Manche {modeState.kind === "killer" || modeState.maxRounds === null ? `${game.currentRound} / ∞` : `${Math.min(game.currentRound, modeState.maxRounds)} / ${modeState.maxRounds}`}</span>
          <button type="button" onClick={() => setShowRules(true)} aria-haspopup="dialog" className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-sm font-bold">Règles</button>
          <button type="button" onClick={confirmAbandon} className="min-h-11 rounded-xl border border-[#713b32] px-3 py-2 text-xs font-bold text-[#ff9b7a] transition-colors hover:bg-[#713b32]/30">Abandonner</button>
        </div>
      </header>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl sm:p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime)]">Au lancer</p>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h1 title={active?.name} className="truncate text-2xl sm:text-3xl font-black tracking-[-.05em]">{active?.name ?? "Partie terminée"}</h1><p className="mt-1 text-sm text-[var(--muted)]">{isCountUp ? "Saisissez chaque fléchette" : modeState.kind === "x01" ? "Atteignez exactement zéro" : modeState.kind === "shanghai" ? `Visez uniquement le ${game.currentRound}` : modeState.kind === "cricket" ? "Fermez 20 à 15 et le Bull" : modeState.kind === "killer" ? modeState.players[active?.id ?? ""]?.isKiller ? "Visez le numéro d’un adversaire" : "Faites trois marques sur votre numéro" : modeState.kind === "training" ? modeState.trainingType === "checkout" ? "Terminez en Double Out" : "Cible à toucher" : "Secteur à viser"}</p></div><motion.strong key={`${active?.id}-${trainingTarget ?? playerScore(active?.id ?? "")}`} initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="shrink-0 text-4xl font-black tabular-nums sm:text-5xl">{active ? modeState.kind === "around-the-clock" && playerScore(active.id) === 21 ? "BULL" : modeState.kind === "killer" ? `N°${modeState.players[active.id]?.number ?? "—"}` : modeState.kind === "training" ? trainingTarget : playerScore(active.id) : 0}</motion.strong></div>
            <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Fléchettes du tour">
              {[0, 1, 2].map((index) => <div key={index} className="grid h-11 place-items-center rounded-xl border border-[var(--line)] bg-black/20 text-lg font-black text-[var(--muted)]">{game.currentTurn.darts[index] ? dartLabel(game.currentTurn.darts[index].score) : `D${index + 1}`}</div>)}
            </div>
            {checkout && <button type="button" aria-expanded={showCheckoutAlternatives} onClick={() => setShowCheckoutAlternatives((visible) => !visible)} className="mt-3 w-full rounded-xl border border-[var(--lime)]/40 bg-[var(--lime)]/5 px-4 py-3 text-left"><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-[.14em] text-[var(--lime)]">Checkout conseillé</span><strong className="tracking-[.08em]">{checkout.darts.join(" · ")}</strong></span>{showCheckoutAlternatives && checkoutRoutes.length > 1 && <span className="mt-3 block border-t border-[var(--line)] pt-3"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Alternatives</span>{checkoutRoutes.slice(1).map((route) => <span key={route.darts.join("-")} className="mr-2 inline-block rounded-lg bg-black/25 px-3 py-2 text-sm font-bold">{route.darts.join(" · ")}</span>)}</span>}</button>}
          </div>

        </div>

        <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <ScoreInput onThrow={throwDart} disabled={game.status !== "in-progress"} />
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={undo} disabled={history.past.length === 0} className="min-h-12 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 font-bold disabled:opacity-35">↶ Annuler</button><button type="button" onClick={() => throwDart(createDart(null, 0, "miss"))} disabled={game.status !== "in-progress"} className="min-h-12 rounded-xl bg-[var(--ink)] px-3 font-black text-black disabled:opacity-35">Lancer manqué</button></div>
        </div>

        <div className="min-w-0 space-y-4 lg:col-start-1">
          {modeState.kind === "cricket" ? <CricketScoreboard state={modeState} players={game.players} activePlayerId={active?.id} /> : modeState.kind === "killer" ? <KillerScoreboard state={modeState} players={game.players} activePlayerId={active?.id} /> : <div className="grid grid-cols-2 gap-3">
            {game.players.map((player, index) => <div key={player.id} className={`rounded-2xl border p-4 ${index === game.currentPlayerIndex && game.status === "in-progress" ? "border-[var(--lime)] bg-[var(--lime)]/5" : "border-[var(--line)] bg-[var(--panel)]"}`}><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: player.color }} /><span className="min-w-0"><span className="block truncate text-sm font-bold">{player.name}</span>{player.ownerUsername&&<span className="block truncate text-[10px] text-[var(--muted)]">@{player.ownerUsername}</span>}</span></div><strong className="mt-2 block text-3xl tabular-nums">{playerScore(player.id)}</strong>{modeState.kind === "x01" && <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{modeState.players[player.id]?.legsWon ?? 0} leg · {modeState.players[player.id]?.setsWon ?? 0} set</span>}{modeState.kind === "training" && <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{modeState.trainingType === "checkout" ? `${modeState.successes}/${modeState.maxRounds} checkouts` : `${modeState.hits}/${modeState.attempts} touches`}</span>}</div>)}
          </div>}

          <TurnHistory turns={game.turns} players={game.players} />
        </div>


      </section>

      <p className="sr-only" aria-live="polite">{active ? `${active.name}, score ${playerScore(active.id)}` : ""}</p>

      <AnimationOverlay />
      <AnimatePresence>{showRules && <GameRulesPanel game={game} onClose={closeRules} />}</AnimatePresence>
      <AnimatePresence>{winner && <FinalResults game={game} onReplay={() => { const context = game.clubId && game.clubName ? { clubId: game.clubId, clubName: game.clubName } : undefined; if (game.modeState.kind === "count-up") useGameStore.getState().start(game.players, game.modeState.maxRounds, context); else if (game.modeState.kind === "x01") useGameStore.getState().startX01(game.players, game.modeState.startingScore, game.modeState.entryRule, game.modeState.exitRule, game.modeState.maxRounds, game.modeState.legsToWin, game.modeState.setsToWin, context); else if (game.modeState.kind === "around-the-clock") useGameStore.getState().startAroundTheClock(game.players, game.modeState.progressionRule, game.modeState.bullFinish, game.modeState.maxRounds, game.modeState.direction, context); else if (game.modeState.kind === "shanghai") useGameStore.getState().startShanghai(game.players, game.modeState.maxRounds, game.modeState.instantShanghaiWin, game.modeState.startTarget, context); else if (game.modeState.kind === "cricket") useGameStore.getState().startCricket(game.players, game.modeState.maxRounds, game.modeState.variant, context); else if (game.modeState.kind === "killer") useGameStore.getState().startKiller(game.players, game.modeState.startingLives, game.modeState.selfDamage, game.modeState.marksToKiller, context); else useGameStore.getState().startTraining(game.players, game.modeState.trainingType, game.modeState.maxRounds, context); }} />}</AnimatePresence>
    </main>
  );
}
