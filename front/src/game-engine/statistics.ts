import type { GameState } from "./types";

export interface FinalStanding {
  rank: number;
  playerId: string;
  name: string;
  ownerUsername?: string;
  color?: string;
  score: number;
  dartsThrown: number;
  bestTurn: number;
  averagePerTurn: number;
  averagePerDart: number;
  isWinner: boolean;
}

export function getFinalStandings(game: GameState): FinalStanding[] {
  const scoreFor = (playerId: string) => game.modeState.kind === "count-up" || game.modeState.kind === "shanghai" ? game.modeState.scores[playerId] ?? 0 : game.modeState.kind === "x01" || game.modeState.kind === "cricket" ? game.modeState.players[playerId]?.score ?? 0 : game.modeState.kind === "killer" ? game.modeState.players[playerId]?.lives ?? 0 : game.modeState.kind === "training" ? game.modeState.score : game.modeState.players[playerId]?.target ?? 1;
  const sorted = [...game.players].sort((a, b) => {
    const cricketDifference = game.modeState.kind === "cricket" ? Object.values(game.modeState.players[b.id]?.marks ?? {}).filter((marks) => marks >= 3).length - Object.values(game.modeState.players[a.id]?.marks ?? {}).filter((marks) => marks >= 3).length : 0;
    const cricketScoreDifference = game.modeState.kind === "cricket" ? game.modeState.variant === "cut-throat" ? scoreFor(a.id) - scoreFor(b.id) : scoreFor(b.id) - scoreFor(a.id) : 0;
    const x01ProgressDifference = game.modeState.kind === "x01" ? (game.modeState.players[b.id]?.setsWon ?? 0) - (game.modeState.players[a.id]?.setsWon ?? 0) || (game.modeState.players[b.id]?.legsWon ?? 0) - (game.modeState.players[a.id]?.legsWon ?? 0) : 0;
    const winnerDifference = a.id === game.winnerId ? -1 : b.id === game.winnerId ? 1 : 0;
    const aroundDifference = game.modeState.kind === "around-the-clock" && game.modeState.direction === "descending" ? scoreFor(a.id) - scoreFor(b.id) : 0;
    const difference = winnerDifference || cricketDifference || cricketScoreDifference || x01ProgressDifference || aroundDifference || (game.modeState.kind === "x01" ? scoreFor(a.id) - scoreFor(b.id) : scoreFor(b.id) - scoreFor(a.id));
    return difference || a.order - b.order;
  });
  return sorted.map((player, index) => {
    const turns = game.turns.filter((turn) => turn.playerId === player.id);
    const total = turns.reduce((sum, turn) => sum + turn.turnScore, 0);
    const dartsThrown = turns.reduce((sum, turn) => sum + turn.darts.length, 0);
    const base = { rank: index + 1, playerId: player.id, name: player.name, ...(player.ownerUsername ? { ownerUsername: player.ownerUsername } : {}), score: scoreFor(player.id), dartsThrown, bestTurn: Math.max(0, ...turns.map((turn) => turn.turnScore)), averagePerTurn: turns.length === 0 ? 0 : total / turns.length, averagePerDart: dartsThrown === 0 ? 0 : total / dartsThrown, isWinner: player.id === game.winnerId };
    return player.color ? { ...base, color: player.color } : base;
  });
}
