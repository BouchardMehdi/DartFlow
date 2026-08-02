import type { GameState } from "./types";

export interface FinalStanding {
  rank: number;
  playerId: string;
  name: string;
  color?: string;
  score: number;
  dartsThrown: number;
  bestTurn: number;
  averagePerTurn: number;
  averagePerDart: number;
  isWinner: boolean;
}

export function getFinalStandings(game: GameState): FinalStanding[] {
  const scoreFor = (playerId: string) => game.modeState.kind === "count-up" ? game.modeState.scores[playerId] ?? 0 : game.modeState.kind === "x01" ? game.modeState.players[playerId]?.score ?? game.modeState.startingScore : game.modeState.players[playerId]?.target ?? 1;
  const sorted = [...game.players].sort((a, b) => {
    const difference = game.modeState.kind === "x01" ? scoreFor(a.id) - scoreFor(b.id) : scoreFor(b.id) - scoreFor(a.id);
    return difference || a.order - b.order;
  });
  return sorted.map((player, index) => {
    const turns = game.turns.filter((turn) => turn.playerId === player.id);
    const total = turns.reduce((sum, turn) => sum + turn.turnScore, 0);
    const dartsThrown = turns.reduce((sum, turn) => sum + turn.darts.length, 0);
    const base = { rank: index + 1, playerId: player.id, name: player.name, score: scoreFor(player.id), dartsThrown, bestTurn: Math.max(0, ...turns.map((turn) => turn.turnScore)), averagePerTurn: turns.length === 0 ? 0 : total / turns.length, averagePerDart: dartsThrown === 0 ? 0 : total / dartsThrown, isWinner: player.id === game.winnerId };
    return player.color ? { ...base, color: player.color } : base;
  });
}
