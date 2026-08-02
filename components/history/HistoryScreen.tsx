"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteSavedGame, loadCompletedGames } from "@/src/database/repositories/game-repository";
import { loadPlayers, normalizePlayerName } from "@/src/database/repositories/player-repository";
import type { SavedPlayer } from "@/src/database/database";
import { getFinalStandings } from "@/src/game-engine/statistics";
import type { GameState } from "@/src/game-engine/types";

const duration = (game: GameState) => {
  const end = game.completedAt ? new Date(game.completedAt).getTime() : new Date(game.updatedAt).getTime();
  const minutes = Math.max(1, Math.round((end - new Date(game.createdAt).getTime()) / 60000));
  return `${minutes} min`;
};

export function HistoryScreen() {
  const [games, setGames] = useState<GameState[]>([]);
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void Promise.all([loadCompletedGames(), loadPlayers()]).then(([savedGames, savedPlayers]) => { if (!active) return; setGames(savedGames); setPlayers(savedPlayers); setLoading(false); }).catch(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const profileStats = useMemo(() => players.map((player) => {
    const normalizedName = normalizePlayerName(player.name);
    const played = games.filter((game) => game.modeState.kind !== "training" && game.players.some((item) => normalizePlayerName(item.name) === normalizedName));
    const standings = played.flatMap((game) => { const matchingIds = new Set(game.players.filter((item) => normalizePlayerName(item.name) === normalizedName).map((item) => item.id)); return getFinalStandings(game).filter((standing) => matchingIds.has(standing.playerId)); });
    const wins = played.filter((game) => { const winner = game.players.find((item) => item.id === game.winnerId); return winner && normalizePlayerName(winner.name) === normalizedName; }).length;
    const darts = standings.reduce((sum, standing) => sum + standing.dartsThrown, 0);
    const weightedScore = standings.reduce((sum, standing) => sum + standing.averagePerDart * standing.dartsThrown, 0);
    return { player, games: played.length, wins, darts, average: darts === 0 ? 0 : weightedScore / darts };
  }).filter((item) => item.games > 0).sort((a, b) => b.wins - a.wins || b.games - a.games), [players, games]);

  const removeGame = async (game: GameState) => {
    if (!window.confirm("Supprimer cette partie de l’historique ?")) return;
    await deleteSavedGame(game.id); setGames((current) => current.filter((item) => item.id !== game.id));
  };

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-5 sm:px-7">
    <header className="mb-8 flex items-center justify-between border-b border-[var(--line)] pb-4"><Link href="/" className="font-bold text-[var(--muted)] hover:text-white">← Accueil</Link><span className="text-sm font-black tracking-[.14em]">HISTORIQUE</span></header>
    <section><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Profils</p><h1 className="mt-2 text-4xl font-black tracking-[-.05em]">Statistiques des joueurs</h1>
      {profileStats.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profileStats.map(({ player, games: count, wins, darts, average }) => <article key={player.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: player.color ?? "var(--lime)" }} /><strong>{player.name}</strong></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[var(--muted)]">Parties</dt><dd className="text-xl font-black">{count}</dd></div><div><dt className="text-[var(--muted)]">Victoires</dt><dd className="text-xl font-black">{wins} <small className="text-xs text-[var(--muted)]">({Math.round(wins / count * 100)} %)</small></dd></div><div><dt className="text-[var(--muted)]">Fléchettes</dt><dd className="font-black">{darts}</dd></div><div><dt className="text-[var(--muted)]">Moy. / flèche</dt><dd className="font-black">{average.toFixed(1)}</dd></div></dl></article>)}</div> : !loading && <p className="mt-5 rounded-2xl border border-[var(--line)] p-5 text-[var(--muted)]">Les statistiques apparaîtront après votre première partie terminée.</p>}
    </section>
    <section className="mt-10"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Parties</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Derniers résultats</h2>
      {loading ? <p className="mt-5 text-[var(--muted)]">Chargement…</p> : games.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--line)] p-5 text-[var(--muted)]">Aucune partie terminée pour le moment.</p> : <div className="mt-5 space-y-3">{games.map((game) => { const winner = game.players.find((player) => player.id === game.winnerId); const mode = game.modeState.kind === "count-up" ? "Count‑Up" : game.modeState.kind === "x01" ? String(game.modeState.startingScore) : game.modeState.kind === "around-the-clock" ? "Around the Clock" : game.modeState.kind === "shanghai" ? "Shanghai" : game.modeState.kind === "cricket" ? "Cricket" : game.modeState.kind === "killer" ? "Killer" : game.modeState.trainingType === "doubles" ? "Entraînement doubles" : game.modeState.trainingType === "triples" ? "Entraînement triples" : game.modeState.trainingType === "checkout" ? "Checkout Challenge" : game.modeState.trainingType === "bobs-27" ? "Bob’s 27" : "Cible aléatoire"; return <article key={game.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="rounded-full bg-[var(--lime)]/10 px-2.5 py-1 text-xs text-[var(--lime)]">{mode}</strong><span className="text-xs text-[var(--muted)]">{new Date(game.completedAt ?? game.updatedAt).toLocaleDateString("fr-FR")} · {duration(game)}</span></div><p className="mt-2 truncate font-bold">{game.modeState.kind === "training" ? `Session de ${winner?.name ?? "—"}` : `Victoire de ${winner?.name ?? "—"}`}</p><p className="mt-1 truncate text-sm text-[var(--muted)]">{game.players.map((player) => player.name).join(" · ")}</p></div><button type="button" onClick={() => void removeGame(game)} className="shrink-0 rounded-xl border border-[#713b32] px-3 py-2 text-xs font-bold text-[#ff9b7a]">Supprimer</button></article>; })}</div>}
    </section>
  </main>;
}
