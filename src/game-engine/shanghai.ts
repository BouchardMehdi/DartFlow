import { getTurnScoreEvent } from "./score-events";
import type { DartThrow, EngineResult, GameEvent, GameState, Player, Turn } from "./types";

const makeTurn = (player: Player, round: number, score: number, now: string): Turn => ({ id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: score, scoreAfterTurn: score, turnScore: 0, isBust: false, isCompleted: false, createdAt: now });

export function createShanghaiGame(players: Player[], maxRounds: number, instantShanghaiWin: boolean, startTarget = 1, now = new Date()): GameState {
  if (players.length < 1 || players.length > 8) throw new Error("Une partie requiert de 1 à 8 joueurs");
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 20) throw new Error("Le nombre de manches doit être compris entre 1 et 20");
  if (!Number.isInteger(startTarget) || startTarget < 1 || startTarget > maxRounds) throw new Error("Le secteur de départ est invalide");
  const ordered = [...players].sort((a, b) => a.order - b.order); const first = ordered[0]; if (!first) throw new Error("Joueur manquant"); const date = now.toISOString();
  return { id: crypto.randomUUID(), modeId: "shanghai", status: "in-progress", players: ordered, currentPlayerIndex: 0, currentRound: startTarget, currentTurn: makeTurn(first, startTarget, 0, date), turns: [], modeState: { kind: "shanghai", startTarget, maxRounds, instantShanghaiWin, scores: Object.fromEntries(ordered.map((player) => [player.id, 0])) }, createdAt: date, updatedAt: date };
}

export function registerShanghaiThrow(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "shanghai") throw new Error("État Shanghai attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex]; if (!player) throw new Error("Joueur actif introuvable");
  const counts = dart.segment === state.currentRound && dart.multiplier > 0; const darts = [...state.currentTurn.darts, dart];
  const turnScore = darts.reduce((sum, item) => sum + (item.segment === state.currentRound ? item.score : 0), 0);
  const multipliers = new Set(darts.filter((item) => item.segment === state.currentRound).map((item) => item.multiplier));
  const shanghai = multipliers.has(1) && multipliers.has(2) && multipliers.has(3);
  const completed = darts.length === 3 || (shanghai && state.modeState.instantShanghaiWin);
  const total = (state.modeState.scores[player.id] ?? 0) + (counts ? dart.score : 0);
  const turn: Turn = { ...state.currentTurn, darts, turnScore, scoreAfterTurn: total, isCompleted: completed };
  const scores = { ...state.modeState.scores, [player.id]: total };
  const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }];
  if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart }); if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart }); if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart });
  if (shanghai) events.push({ type: "SHANGHAI", playerId: player.id, target: state.currentRound });
  if (shanghai && state.modeState.instantShanghaiWin) { events.push({ type: "TURN_COMPLETED", turn }, { type: "GAME_WON", playerId: player.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, scores }, winnerId: player.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: { ...state.modeState, scores }, updatedAt: now.toISOString() }, events };
  events.push({ type: "TURN_COMPLETED", turn }); const scoreEvent = getTurnScoreEvent(turnScore); if (scoreEvent) events.push(scoreEvent);
  const last = state.currentPlayerIndex === state.players.length - 1;
  if (last && state.currentRound === state.modeState.maxRounds) { const winner = [...state.players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.order - b.order)[0]; if (!winner) throw new Error("Gagnant introuvable"); events.push({ type: "GAME_WON", playerId: winner.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, scores }, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  const nextIndex = last ? 0 : state.currentPlayerIndex + 1; const nextRound = last ? state.currentRound + 1 : state.currentRound; const next = state.players[nextIndex]; if (!next) throw new Error("Joueur suivant introuvable"); events.push({ type: "PLAYER_CHANGED", playerId: next.id });
  return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(next, nextRound, scores[next.id] ?? 0, now.toISOString()), turns: [...state.turns, turn], modeState: { ...state.modeState, scores }, updatedAt: now.toISOString() }, events };
}
