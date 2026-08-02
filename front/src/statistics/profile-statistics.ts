import type { SavedPlayer } from "@/src/database/database";
import { normalizePlayerName } from "@/src/database/repositories/player-repository";
import { getFinalStandings } from "@/src/game-engine/statistics";
import type { GameState } from "@/src/game-engine/types";

export interface ModeStatistics {
  key: string;
  label: string;
  games: number;
  wins: number;
  dartsThrown: number;
  turnsPlayed: number;
  pointsScored: number;
  bestTurn: number;
  averagePerTurn: number;
  averagePerDart: number;
}

export interface ProfileStatistics {
  profile: SavedPlayer;
  totals: ModeStatistics;
  modes: ModeStatistics[];
}

const mode = (game: GameState): { key: string; label: string } => {
  const state = game.modeState;
  if (state.kind === "x01") return { key: `x01-${state.startingScore}`, label: String(state.startingScore) };
  if (state.kind === "count-up") return { key: "count-up", label: "Count-Up" };
  if (state.kind === "around-the-clock") return { key: "around-the-clock", label: "Around the Clock" };
  if (state.kind === "shanghai") return { key: "shanghai", label: "Shanghai" };
  if (state.kind === "cricket") return { key: `cricket-${state.variant}`, label: state.variant === "standard" ? "Cricket standard" : state.variant === "no-score" ? "Cricket sans points" : "Cut-Throat Cricket" };
  if (state.kind === "killer") return { key: "killer", label: "Killer" };
  const labels = { doubles: "Entraînement doubles", triples: "Entraînement triples", checkout: "Checkout Challenge", "bobs-27": "Bob’s 27", "random-target": "Cible aléatoire" };
  return { key: `training-${state.trainingType}`, label: labels[state.trainingType] };
};

interface MutableStats { key: string; label: string; games: number; wins: number; dartsThrown: number; turnsPlayed: number; pointsScored: number; bestTurn: number }
const finish = (stats: MutableStats): ModeStatistics => ({ ...stats, averagePerTurn: stats.turnsPlayed ? stats.pointsScored / stats.turnsPlayed : 0, averagePerDart: stats.dartsThrown ? stats.pointsScored / stats.dartsThrown : 0 });

export function buildProfileStatistics(profiles: SavedPlayer[], games: GameState[]): ProfileStatistics[] {
  return profiles.map((profile) => {
    const grouped = new Map<string, MutableStats>();
    for (const game of games.filter((item) => item.status === "completed")) {
      const exact = game.players.find((player) => player.id === profile.id);
      const player = exact ?? (!profile.ownerUserId ? game.players.find((item) => normalizePlayerName(item.name) === normalizePlayerName(profile.name)) : undefined);
      if (!player) continue;
      const descriptor = mode(game); const stats = grouped.get(descriptor.key) ?? { ...descriptor, games: 0, wins: 0, dartsThrown: 0, turnsPlayed: 0, pointsScored: 0, bestTurn: 0 };
      const standing = getFinalStandings(game).find((item) => item.playerId === player.id);
      const turns = game.turns.filter((turn) => turn.playerId === player.id && turn.isCompleted);
      const score = turns.reduce((sum, turn) => sum + turn.turnScore, 0);
      stats.games += 1; stats.wins += game.modeState.kind !== "training" && game.winnerId === player.id ? 1 : 0; stats.dartsThrown += standing?.dartsThrown ?? turns.reduce((sum, turn) => sum + turn.darts.length, 0); stats.turnsPlayed += turns.length; stats.pointsScored += score; stats.bestTurn = Math.max(stats.bestTurn, standing?.bestTurn ?? 0);
      grouped.set(descriptor.key, stats);
    }
    const modes = [...grouped.values()].map(finish).sort((a, b) => b.games - a.games || a.label.localeCompare(b.label, "fr"));
    const totalMutable = modes.reduce<MutableStats>((total, item) => ({ ...total, games: total.games + item.games, wins: total.wins + item.wins, dartsThrown: total.dartsThrown + item.dartsThrown, turnsPlayed: total.turnsPlayed + item.turnsPlayed, pointsScored: total.pointsScored + item.pointsScored, bestTurn: Math.max(total.bestTurn, item.bestTurn) }), { key: "all", label: "Tous les modes", games: 0, wins: 0, dartsThrown: 0, turnsPlayed: 0, pointsScored: 0, bestTurn: 0 });
    return { profile, totals: finish(totalMutable), modes };
  }).filter((item) => item.totals.games > 0).sort((a, b) => b.totals.games - a.totals.games);
}
