import type { DartThrow, EngineResult, GameEvent, GameState, Player, Turn, X01EntryRule, X01ExitRule } from "./types";
import { getTurnScoreEvent } from "./score-events";

const makeTurn = (player: Player, round: number, score: number, now: string): Turn => ({
  id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: score,
  scoreAfterTurn: score, turnScore: 0, isBust: false, isCompleted: false, createdAt: now,
});

const qualifies = (dart: DartThrow, rule: X01EntryRule | X01ExitRule) =>
  rule === "straight" || (rule === "double" && (dart.multiplier === 2 || dart.zone === "inner-bull")) ||
  (rule === "master" && (dart.multiplier === 2 || dart.multiplier === 3 || dart.zone === "inner-bull"));

export function createX01Game(players: Player[], startingScore: 301 | 501 | 701, entryRule: X01EntryRule, exitRule: X01ExitRule, maxRounds: number | null = 20, now = new Date()): GameState {
  if (players.length < 1 || players.length > 8) throw new Error("Une partie requiert de 1 à 8 joueurs");
  if (maxRounds !== null && (!Number.isInteger(maxRounds) || maxRounds < 1)) throw new Error("Nombre de manches invalide");
  const ordered = [...players].sort((a, b) => a.order - b.order); const first = ordered[0];
  if (!first) throw new Error("Joueur manquant");
  const date = now.toISOString();
  return { id: crypto.randomUUID(), modeId: "x01", status: "in-progress", players: ordered, currentPlayerIndex: 0, currentRound: 1,
    currentTurn: makeTurn(first, 1, startingScore, date), turns: [], modeState: { kind: "x01", startingScore, entryRule, exitRule, maxRounds,
      players: Object.fromEntries(ordered.map((player) => [player.id, { score: startingScore, hasEntered: entryRule === "straight" }])) }, createdAt: date, updatedAt: date };
}

export function registerX01Throw(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "x01") throw new Error("État X01 attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex]; if (!player) throw new Error("Joueur actif introuvable");
  const playerState = state.modeState.players[player.id]; if (!playerState) throw new Error("Score joueur introuvable");
  const entered = playerState.hasEntered || qualifies(dart, state.modeState.entryRule);
  const appliedScore = entered ? dart.score : 0;
  const remaining = playerState.score - appliedScore;
  const invalidFinish = remaining === 0 && !qualifies(dart, state.modeState.exitRule);
  const impossibleRemainder = remaining === 1 && state.modeState.exitRule !== "straight";
  const bust = remaining < 0 || invalidFinish || impossibleRemainder;
  const checkout = remaining === 0 && !bust;
  const darts = [...state.currentTurn.darts, dart];
  const completed = darts.length === 3 || bust || checkout;
  const scoreAfterTurn = bust ? state.currentTurn.scoreBeforeTurn : remaining;
  const turn: Turn = { ...state.currentTurn, darts, turnScore: bust ? 0 : state.currentTurn.scoreBeforeTurn - scoreAfterTurn, scoreAfterTurn, isBust: bust, isCompleted: completed };
  const nextPlayerState = { score: scoreAfterTurn, hasEntered: bust ? playerState.hasEntered : entered };
  const modePlayers = { ...state.modeState.players, [player.id]: nextPlayerState };
  const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }];
  if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart });
  if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart });
  if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart });
  if (checkout) {
    const scoreEvent = getTurnScoreEvent(turn.turnScore); if (scoreEvent) events.push(scoreEvent);
    events.push({ type: "CHECKOUT", playerId: player.id }, { type: "GAME_WON", playerId: player.id });
    return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, winnerId: player.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events };
  }
  if (bust) events.push({ type: "BUST", playerId: player.id });
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: { ...state.modeState, players: modePlayers }, updatedAt: now.toISOString() }, events };
  events.push({ type: "TURN_COMPLETED", turn });
  const scoreEvent = getTurnScoreEvent(turn.turnScore); if (scoreEvent) events.push(scoreEvent);
  const last = state.currentPlayerIndex === state.players.length - 1; const nextIndex = last ? 0 : state.currentPlayerIndex + 1; const nextRound = last ? state.currentRound + 1 : state.currentRound;
  if (last && state.modeState.maxRounds !== null && state.currentRound === state.modeState.maxRounds) {
    const winner = [...state.players].sort((a, b) => (modePlayers[a.id]?.score ?? Infinity) - (modePlayers[b.id]?.score ?? Infinity) || a.order - b.order)[0];
    if (!winner) throw new Error("Gagnant introuvable");
    events.push({ type: "GAME_WON", playerId: winner.id });
    return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events };
  }
  const next = state.players[nextIndex]; if (!next) throw new Error("Joueur suivant introuvable");
  const nextScore = modePlayers[next.id]?.score; if (nextScore === undefined) throw new Error("Score suivant introuvable");
  events.push({ type: "PLAYER_CHANGED", playerId: next.id });
  return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(next, nextRound, nextScore, now.toISOString()), turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, updatedAt: now.toISOString() }, events };
}
