import type { DartThrow, EngineResult, GameEvent, GameState, Player, Turn } from "./types";

const makeTurn = (player: Player, round: number, now: string): Turn => ({ id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: 0, scoreAfterTurn: 0, turnScore: 0, isBust: false, isCompleted: false, createdAt: now });

export function assignKillerNumbers(players: Player[], random: () => number = Math.random): Record<string, number> {
  const available = Array.from({ length: 20 }, (_, index) => index + 1);
  for (let index = available.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); const value = available[index]; const other = available[target]; if (value !== undefined && other !== undefined) { available[index] = other; available[target] = value; } }
  return Object.fromEntries(players.map((player, index) => [player.id, available[index] ?? index + 1]));
}

interface KillerGameOptions { selfDamage?: boolean; marksToKiller?: number; random?: () => number; }

export function createKillerGame(players: Player[], startingLives: number, optionsOrRandom: KillerGameOptions | (() => number) = {}, now = new Date()): GameState {
  if (players.length < 2 || players.length > 8) throw new Error("Killer requiert de 2 à 8 joueurs");
  if (!Number.isInteger(startingLives) || startingLives < 1 || startingLives > 5) throw new Error("Le nombre de vies doit être compris entre 1 et 5");
  const options = typeof optionsOrRandom === "function" ? { random: optionsOrRandom } : optionsOrRandom;
  const marksToKiller = options.marksToKiller ?? 3;
  if (!Number.isInteger(marksToKiller) || marksToKiller < 1 || marksToKiller > 5) throw new Error("Le nombre de marques doit être compris entre 1 et 5");
  const ordered = [...players].sort((a, b) => a.order - b.order); const first = ordered[0]; if (!first) throw new Error("Joueur manquant"); const numbers = assignKillerNumbers(ordered, options.random); const date = now.toISOString();
  return { id: crypto.randomUUID(), modeId: "killer", status: "in-progress", players: ordered, currentPlayerIndex: 0, currentRound: 1, currentTurn: makeTurn(first, 1, date), turns: [], modeState: { kind: "killer", startingLives, marksToKiller, selfDamage: options.selfDamage ?? false, players: Object.fromEntries(ordered.map((player) => [player.id, { number: numbers[player.id] ?? 1, marks: 0, isKiller: false, lives: startingLives, eliminated: false }])) }, createdAt: date, updatedAt: date };
}

const nextActiveIndex = (state: GameState, playersState: Record<string, { eliminated: boolean }>, from: number) => {
  for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; const player = state.players[index]; if (player && !playersState[player.id]?.eliminated) return index; }
  return from;
};

export function registerKillerThrow(state: GameState, dart: DartThrow, now = new Date()): EngineResult {
  if (state.modeState.kind !== "killer") throw new Error("État Killer attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[state.currentPlayerIndex]; if (!player) throw new Error("Joueur actif introuvable"); const attacker = state.modeState.players[player.id]; if (!attacker) throw new Error("État joueur introuvable");
  const playersState = structuredClone(state.modeState.players); const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }]; let damage = 0;
  if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart }); if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart }); if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart });
  if (dart.segment !== null && dart.multiplier > 0) {
    if (!attacker.isKiller && dart.segment === attacker.number) { const marks = Math.min(state.modeState.marksToKiller, attacker.marks + dart.multiplier); const becameKiller = marks >= state.modeState.marksToKiller; playersState[player.id] = { ...attacker, marks, isKiller: becameKiller }; if (becameKiller) events.push({ type: "KILLER_ACHIEVED", playerId: player.id }); }
    else if (attacker.isKiller) {
      const victim = state.players.find((item) => { const candidate = playersState[item.id]; return candidate && !candidate.eliminated && candidate.number === dart.segment && (item.id !== player.id || state.modeState.kind === "killer" && state.modeState.selfDamage); });
      if (victim) { const victimState = playersState[victim.id]; if (victimState) { const lives = Math.max(0, victimState.lives - dart.multiplier); damage = victimState.lives - lives; const eliminated = lives === 0; playersState[victim.id] = { ...victimState, lives, eliminated }; if (eliminated) events.push({ type: "PLAYER_ELIMINATED", playerId: victim.id }); } }
    }
  }
  const activePlayers = state.players.filter((item) => !playersState[item.id]?.eliminated); const won = activePlayers.length === 1; const darts = [...state.currentTurn.darts, dart]; const attackerEliminated = playersState[player.id]?.eliminated ?? false; const completed = darts.length === 3 || won || attackerEliminated; const turnScore = state.currentTurn.turnScore + damage; const turn: Turn = { ...state.currentTurn, darts, turnScore, scoreAfterTurn: turnScore, isCompleted: completed };
  if (won) { const winner = activePlayers[0]; if (!winner) throw new Error("Gagnant introuvable"); events.push({ type: "TURN_COMPLETED", turn }, { type: "GAME_WON", playerId: winner.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState: { ...state.modeState, players: playersState }, winnerId: winner.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; }
  if (!completed) return { state: { ...state, currentTurn: turn, modeState: { ...state.modeState, players: playersState }, updatedAt: now.toISOString() }, events };
  events.push({ type: "TURN_COMPLETED", turn }); const nextIndex = nextActiveIndex(state, playersState, state.currentPlayerIndex); const wrapped = nextIndex <= state.currentPlayerIndex; const nextRound = wrapped ? state.currentRound + 1 : state.currentRound; const next = state.players[nextIndex]; if (!next) throw new Error("Joueur suivant introuvable"); events.push({ type: "PLAYER_CHANGED", playerId: next.id });
  return { state: { ...state, currentPlayerIndex: nextIndex, currentRound: nextRound, currentTurn: makeTurn(next, nextRound, now.toISOString()), turns: [...state.turns, turn], modeState: { ...state.modeState, players: playersState }, updatedAt: now.toISOString() }, events };
}
