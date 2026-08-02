import type { AroundTheClockProgressionRule, DartThrow, EngineResult, GameEvent, GameState, Player, Turn } from "./types";

const makeTurn = (player: Player, round: number, target: number, now: string): Turn => ({ id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: target, scoreAfterTurn: target, turnScore: 0, isBust: false, isCompleted: false, createdAt: now });
const isBull = (dart: DartThrow) => dart.zone === "outer-bull" || dart.zone === "inner-bull";

export function createAroundTheClockGame(players: Player[], progressionRule: AroundTheClockProgressionRule, bullFinish: boolean, maxRounds: number | null, now = new Date()): GameState {
  if (players.length < 1 || players.length > 8) throw new Error("Une partie requiert de 1 à 8 joueurs");
  if (maxRounds !== null && (!Number.isInteger(maxRounds) || maxRounds < 1)) throw new Error("Nombre de manches invalide");
  const ordered = [...players].sort((a, b) => a.order - b.order); const first = ordered[0]; if (!first) throw new Error("Joueur manquant");
  const date = now.toISOString();
  return { id: crypto.randomUUID(), modeId: "around-the-clock", status: "in-progress", players: ordered, currentPlayerIndex: 0, currentRound: 1, currentTurn: makeTurn(first, 1, 1, date), turns: [], modeState: { kind: "around-the-clock", progressionRule, bullFinish, maxRounds, players: Object.fromEntries(ordered.map((player) => [player.id, { target: 1, completed: false }])) }, createdAt: date, updatedAt: date };
}

export function registerAroundTheClockThrow(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "around-the-clock") throw new Error("État Around the Clock attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex]; if (!player) throw new Error("Joueur actif introuvable");
  const playerState = state.modeState.players[player.id]; if (!playerState) throw new Error("Progression introuvable");
  const targetHit = playerState.target === 21 ? isBull(dart) : dart.segment === playerState.target && (state.modeState.progressionRule !== "single-only" || dart.multiplier === 1);
  const steps = targetHit ? state.modeState.progressionRule === "multiplier" && playerState.target <= 20 ? Math.max(1, dart.multiplier) : 1 : 0;
  let target = playerState.target;
  let won = false;
  if (targetHit) {
    if (playerState.target === 21 || (!state.modeState.bullFinish && playerState.target + steps > 20)) won = true;
    else target = Math.min(state.modeState.bullFinish ? 21 : 20, playerState.target + steps);
  }
  const darts = [...state.currentTurn.darts, dart]; const completed = darts.length === 3 || won;
  const turn: Turn = { ...state.currentTurn, darts, scoreAfterTurn: target, turnScore: target - state.currentTurn.scoreBeforeTurn, isCompleted: completed };
  const modePlayers = { ...state.modeState.players, [player.id]: { target, completed: won } };
  const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }];
  if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart }); if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart }); if (isBull(dart)) events.push({ type: "BULL_HIT", dart });
  if (won) { events.push({ type: "TURN_COMPLETED", turn }, { type: "GAME_WON", playerId: player.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, winnerId: player.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: { ...state.modeState, players: modePlayers }, updatedAt: now.toISOString() }, events };
  events.push({ type: "TURN_COMPLETED", turn });
  const last = state.currentPlayerIndex === state.players.length - 1;
  if (last && state.modeState.maxRounds !== null && state.currentRound === state.modeState.maxRounds) {
    const winner = [...state.players].sort((a, b) => (modePlayers[b.id]?.target ?? 1) - (modePlayers[a.id]?.target ?? 1) || a.order - b.order)[0]; if (!winner) throw new Error("Gagnant introuvable");
    events.push({ type: "GAME_WON", playerId: winner.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events };
  }
  const nextIndex = last ? 0 : state.currentPlayerIndex + 1; const nextRound = last ? state.currentRound + 1 : state.currentRound; const next = state.players[nextIndex]; if (!next) throw new Error("Joueur suivant introuvable"); const nextTarget = modePlayers[next.id]?.target ?? 1;
  events.push({ type: "PLAYER_CHANGED", playerId: next.id }); return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(next, nextRound, nextTarget, now.toISOString()), turns: [...state.turns, turn], modeState: { ...state.modeState, players: modePlayers }, updatedAt: now.toISOString() }, events };
}
