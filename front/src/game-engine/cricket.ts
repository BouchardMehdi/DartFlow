import type { CricketTarget, CricketVariant, DartThrow, EngineResult, GameEvent, GameState, Player, Turn } from "./types";

import { CRICKET_TARGETS, countClosedCricketTargets, getCricketTargets, randomCricketTargets } from "./cricket-targets";
export { CRICKET_TARGETS } from "./cricket-targets";
const emptyMarks = (targets: readonly CricketTarget[]) => Object.fromEntries(targets.map(target => [target, 0]));
const makeTurn = (player: Player, round: number, score: number, now: string): Turn => ({ id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: score, scoreAfterTurn: score, turnScore: 0, isBust: false, isCompleted: false, createdAt: now });
const dartTarget = (dart: DartThrow): CricketTarget | null => dart.zone === "miss" || dart.multiplier === 0 ? null : dart.zone === "outer-bull" || dart.zone === "inner-bull" ? "bull" : dart.segment;
const markCount = (dart: DartThrow) => dart.zone === "inner-bull" ? 2 : dart.zone === "outer-bull" ? 1 : dart.multiplier;
const targetValue = (target: CricketTarget) => target === "bull" ? 25 : target;


export function createCricketGame(players: Player[], maxRounds: number | null, variant: CricketVariant = "standard", now = new Date(), random: () => number = Math.random): GameState {
  if (players.length < 1 || players.length > 8) throw new Error("Une partie requiert de 1 à 8 joueurs");
  if (maxRounds !== null && (!Number.isInteger(maxRounds) || maxRounds < 1)) throw new Error("Nombre de manches invalide");
  const ordered = [...players].sort((a, b) => a.order - b.order); const first = ordered[0]; if (!first) throw new Error("Joueur manquant"); const date = now.toISOString();
  const targets = variant === "random" || variant === "hidden" ? randomCricketTargets(random) : [...CRICKET_TARGETS];
  return { id: crypto.randomUUID(), modeId: "cricket", status: "in-progress", players: ordered, currentPlayerIndex: 0, currentRound: 1, currentTurn: makeTurn(first, 1, 0, date), turns: [], modeState: { kind: "cricket", variant, maxRounds, targets, revealedTargets: variant === "hidden" ? [] : [...targets], players: Object.fromEntries(ordered.map((player) => [player.id, { score: 0, marks: emptyMarks(targets) }])) }, createdAt: date, updatedAt: date };
}

export function registerCricketThrow(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "cricket") throw new Error("État Cricket attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex]; if (!player) throw new Error("Joueur actif introuvable"); const playerState = state.modeState.players[player.id]; if (!playerState) throw new Error("État joueur introuvable");
  const targets = getCricketTargets(state.modeState);
  const candidate = dartTarget(dart);
  const target = candidate !== null && targets.includes(candidate) ? candidate : null; const marks = { ...playerState.marks }; let points = 0; let inflictedPoints = 0; let justClosed = false;
  if (target !== null) {
    const before = marks[target] ?? 0; const total = before + markCount(dart); marks[target] = Math.min(3, total); justClosed = before < 3 && total >= 3;
    const excess = Math.max(0, total - 3); const everyoneElseClosed = state.players.filter((item) => item.id !== player.id).every((item) => (state.modeState.kind === "cricket" ? state.modeState.players[item.id]?.marks[target] ?? 0 : 0) >= 3);
    if (excess > 0 && !everyoneElseClosed && state.modeState.variant !== "no-score" && state.modeState.variant !== "cut-throat") points = excess * targetValue(target);
  }
  const score = playerState.score + points; const nextPlayerState = { score, marks }; const modePlayers = { ...state.modeState.players, [player.id]: nextPlayerState };
  if (target !== null && state.modeState.variant === "cut-throat") { const excess = Math.max(0, (playerState.marks[target] ?? 0) + markCount(dart) - 3); if (excess > 0) for (const opponent of state.players) { const opponentState = modePlayers[opponent.id]; if (opponent.id !== player.id && opponentState && (opponentState.marks[target] ?? 0) < 3) { const damage = excess * targetValue(target); inflictedPoints += damage; modePlayers[opponent.id] = { ...opponentState, score: opponentState.score + damage }; } } }
  const revealedTargets = state.modeState.variant === "hidden" && target !== null && !state.modeState.revealedTargets?.includes(target) ? [...(state.modeState.revealedTargets ?? []), target] : state.modeState.revealedTargets;
  const nextMode = { ...state.modeState, players: modePlayers, ...(revealedTargets ? { revealedTargets } : {}) };
  const hasClosedAll = targets.every((item) => (marks[item] ?? 0) >= 3); const scoreCondition = state.modeState.variant === "no-score" || state.players.every((item) => item.id === player.id || (state.modeState.kind === "cricket" && (state.modeState.variant === "cut-throat" ? score <= (modePlayers[item.id]?.score ?? 0) : score >= (modePlayers[item.id]?.score ?? 0)))); const won = hasClosedAll && scoreCondition;
  const darts = [...state.currentTurn.darts, dart]; const completed = darts.length === 3 || won; const turnScore = state.currentTurn.turnScore + points + inflictedPoints; const turn: Turn = { ...state.currentTurn, darts, scoreAfterTurn: score, turnScore, isCompleted: completed };
  const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }]; if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart }); if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart }); if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart }); if (justClosed && target !== null) events.push({ type: "CRICKET_CLOSED", playerId: player.id, target });
  if (won) { events.push({ type: "TURN_COMPLETED", turn }, { type: "GAME_WON", playerId: player.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: nextMode, winnerId: player.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: nextMode, updatedAt: now.toISOString() }, events };
  events.push({ type: "TURN_COMPLETED", turn }); const last = state.currentPlayerIndex === state.players.length - 1;
  if (last && state.modeState.maxRounds !== null && state.currentRound === state.modeState.maxRounds) { const winner = [...state.players].sort((a, b) => countClosedCricketTargets(nextMode, b.id) - countClosedCricketTargets(nextMode, a.id) || (state.modeState.kind === "cricket" && state.modeState.variant === "cut-throat" ? (modePlayers[a.id]?.score ?? 0) - (modePlayers[b.id]?.score ?? 0) : (modePlayers[b.id]?.score ?? 0) - (modePlayers[a.id]?.score ?? 0)) || a.order - b.order)[0]; if (!winner) throw new Error("Gagnant introuvable"); events.push({ type: "GAME_WON", playerId: winner.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: nextMode, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  const nextIndex = last ? 0 : state.currentPlayerIndex + 1; const nextRound = last ? state.currentRound + 1 : state.currentRound; const next = state.players[nextIndex]; if (!next) throw new Error("Joueur suivant introuvable"); events.push({ type: "PLAYER_CHANGED", playerId: next.id });
  return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(next, nextRound, modePlayers[next.id]?.score ?? 0, now.toISOString()), turns: [...state.turns, turn], modeState: nextMode, updatedAt: now.toISOString() }, events };
}
