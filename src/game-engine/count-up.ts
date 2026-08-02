import type { DartThrow, EngineResult, GameEvent, GameHistory, GameState, Player, Turn } from "./types";
import { getTurnScoreEvent } from "./score-events";

const makeTurn = (player: Player, round: number, score: number, now: string): Turn => ({
  id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: score,
  scoreAfterTurn: score, turnScore: 0, isBust: false, isCompleted: false, createdAt: now,
});

export function createCountUpGame(players: Player[], maxRounds = 8, now = new Date()): GameState {
  if (players.length < 1 || players.length > 8) throw new Error("Une partie requiert de 1 à 8 joueurs");
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new Error("Nombre de manches invalide");
  const ordered = [...players].sort((a, b) => a.order - b.order);
  const first = ordered[0];
  if (!first) throw new Error("Joueur manquant");
  const date = now.toISOString();
  const scores = Object.fromEntries(ordered.map((player) => [player.id, 0]));
  return { id: crypto.randomUUID(), modeId: "count-up", status: "in-progress", players: ordered, currentPlayerIndex: 0,
    currentRound: 1, currentTurn: makeTurn(first, 1, 0, date), turns: [], modeState: { kind: "count-up", maxRounds, scores },
    createdAt: date, updatedAt: date };
}

export function registerThrow(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "count-up") throw new Error("État Count-Up attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error("Joueur actif introuvable");
  const darts = [...state.currentTurn.darts, dart];
  const score = darts.reduce((total, item) => total + item.score, 0);
  const completed = darts.length === 3;
  const turn: Turn = { ...state.currentTurn, darts, turnScore: score, scoreAfterTurn: state.currentTurn.scoreBeforeTurn + score, isCompleted: completed };
  const scores = { ...state.modeState.scores, [player.id]: turn.scoreAfterTurn };
  const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }];
  if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart });
  if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart });
  if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart });
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: { ...state.modeState, scores }, updatedAt: now.toISOString() }, events };

  events.push({ type: "TURN_COMPLETED", turn });
  const scoreEvent = getTurnScoreEvent(turn.turnScore);
  if (scoreEvent) events.push(scoreEvent);
  const lastPlayer = state.currentPlayerIndex === state.players.length - 1;
  const gameFinished = lastPlayer && state.currentRound === state.modeState.maxRounds;
  if (gameFinished) {
    const winner = [...state.players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))[0];
    if (!winner) throw new Error("Gagnant introuvable");
    events.push({ type: "GAME_WON", playerId: winner.id });
    return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, scores }, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events };
  }
  const nextIndex = lastPlayer ? 0 : state.currentPlayerIndex + 1;
  const nextRound = lastPlayer ? state.currentRound + 1 : state.currentRound;
  const nextPlayer = state.players[nextIndex];
  if (!nextPlayer) throw new Error("Joueur suivant introuvable");
  events.push({ type: "PLAYER_CHANGED", playerId: nextPlayer.id });
  return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(nextPlayer, nextRound, scores[nextPlayer.id] ?? 0, now.toISOString()), turns: [...state.turns, turn], modeState: { ...state.modeState, scores }, updatedAt: now.toISOString() }, events };
}

export const createHistory = (state: GameState): GameHistory => ({ present: state, past: [] });
export const applyCountUpThrow = (history: GameHistory, dart: DartThrow): GameHistory => ({ past: [...history.past, structuredClone(history.present)], present: registerThrow(history.present, dart).state });
export const undoLastThrow = (history: GameHistory): GameHistory => {
  const previous = history.past.at(-1);
  return previous ? { present: previous, past: history.past.slice(0, -1) } : history;
};

export const abandonGame = (state: GameState, now = new Date()): GameState => ({
  ...state,
  status: "cancelled",
  updatedAt: now.toISOString(),
});
