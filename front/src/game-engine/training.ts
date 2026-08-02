import type { DartThrow, EngineResult, GameEvent, GameState, Player, TrainingTarget, TrainingType, Turn } from "./types";

const makeTurn = (player: Player, round: number, score: number, now: string): Turn => ({ id: crypto.randomUUID(), playerId: player.id, roundNumber: round, darts: [], scoreBeforeTurn: score, scoreAfterTurn: score, turnScore: 0, isBust: false, isCompleted: false, createdAt: now });
const numberedTarget = (segment: number, multiplier: 1 | 2 | 3): TrainingTarget => ({ segment, multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", label: `${multiplier === 1 ? "S" : multiplier === 2 ? "D" : "T"}${segment}` });
const CHECKOUT_BOGEY_NUMBERS = new Set([159, 162, 163, 165, 166, 168, 169]);
const CHECKOUT_SCORES = Array.from({ length: 169 }, (_, index) => index + 2).filter((score) => !CHECKOUT_BOGEY_NUMBERS.has(score));

export function generateCheckoutTarget(random: () => number = Math.random): number { return CHECKOUT_SCORES[Math.floor(random() * CHECKOUT_SCORES.length)] ?? 40; }

export function generateRandomTarget(random: () => number = Math.random): TrainingTarget {
  const targets: TrainingTarget[] = [
    ...Array.from({ length: 20 }, (_, index) => numberedTarget(index + 1, 1)),
    ...Array.from({ length: 20 }, (_, index) => numberedTarget(index + 1, 2)),
    ...Array.from({ length: 20 }, (_, index) => numberedTarget(index + 1, 3)),
    { segment: null, multiplier: 1, zone: "outer-bull", label: "25" },
    { segment: null, multiplier: 2, zone: "inner-bull", label: "BULL" },
  ];
  return targets[Math.floor(random() * targets.length)] ?? numberedTarget(20, 1);
}

const targetHit = (dart: DartThrow, target: TrainingTarget) => target.zone === "outer-bull" || target.zone === "inner-bull" ? dart.zone === target.zone : dart.segment === target.segment && dart.multiplier === target.multiplier;
const visualEvents = (dart: DartThrow): GameEvent[] => { const events: GameEvent[] = [{ type: "DART_REGISTERED", dart }]; if (dart.zone === "double") events.push({ type: "DOUBLE_HIT", dart }); if (dart.zone === "triple") events.push({ type: "TRIPLE_HIT", dart }); if (dart.zone === "outer-bull" || dart.zone === "inner-bull") events.push({ type: "BULL_HIT", dart }); return events; };

export function createTrainingGame(players: Player[], trainingType: TrainingType, maxRounds = 10, random: () => number = Math.random, now = new Date()): GameState {
  if (players.length !== 1) throw new Error("Un entraînement requiert exactement un joueur");
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 50) throw new Error("Nombre de manches invalide");
  const player = { ...players[0]!, order: 0 }; const rounds = trainingType === "doubles" || trainingType === "triples" || trainingType === "bobs-27" ? 20 : maxRounds;
  const target = trainingType === "doubles" || trainingType === "bobs-27" ? numberedTarget(1, 2) : trainingType === "triples" ? numberedTarget(1, 3) : trainingType === "random-target" ? generateRandomTarget(random) : null;
  const checkoutStart = trainingType === "checkout" ? generateCheckoutTarget(random) : null; const score = trainingType === "bobs-27" ? 27 : 0; const date = now.toISOString();
  return { id: crypto.randomUUID(), modeId: "training", status: "in-progress", players: [player], currentPlayerIndex: 0, currentRound: 1, currentTurn: makeTurn(player, 1, score, date), turns: [], modeState: { kind: "training", trainingType, maxRounds: rounds, target, checkoutStart, remaining: checkoutStart, score, hits: 0, attempts: 0, successes: 0 }, createdAt: date, updatedAt: date };
}

const completeSession = (state: GameState, turn: Turn, modeState: Extract<GameState["modeState"], { kind: "training" }>, events: GameEvent[], now: Date): EngineResult => { const player = state.players[0]; if (!player) throw new Error("Joueur introuvable"); events.push({ type: "TURN_COMPLETED", turn }, { type: "GAME_WON", playerId: player.id }); return { state: { ...state, status: "completed", currentTurn: turn, turns: [...state.turns, turn], modeState, winnerId: player.id, updatedAt: now.toISOString(), completedAt: now.toISOString() }, events }; };

export function registerTrainingThrow(state: GameState, dart: DartThrow, random: () => number = Math.random, now = new Date()): EngineResult {
  if (state.modeState.kind !== "training") throw new Error("État d’entraînement attendu");
  if (state.status !== "in-progress" || state.currentTurn.darts.length >= 3) return { state, events: [] };
  const player = state.players[0]; if (!player) throw new Error("Joueur introuvable");
  const mode = state.modeState; const events = visualEvents(dart); const darts = [...state.currentTurn.darts, dart]; const attempts = mode.attempts + 1;

  if (mode.trainingType === "checkout") {
    const before = mode.remaining ?? mode.checkoutStart ?? 40; const after = before - dart.score; const validCheckout = after === 0 && (dart.multiplier === 2 || dart.zone === "inner-bull"); const bust = after < 0 || after === 1 || after === 0 && !validCheckout; const challengeDone = validCheckout || bust || darts.length === 3; const score = mode.score + (validCheckout ? 1 : 0); const hits = mode.hits + (validCheckout ? 1 : 0); const remaining = bust ? mode.checkoutStart : Math.max(0, after); const turn: Turn = { ...state.currentTurn, darts, scoreAfterTurn: score, turnScore: validCheckout ? 1 : 0, isBust: bust, isCompleted: challengeDone };
    if (validCheckout) events.push({ type: "CHECKOUT", playerId: player.id }, { type: "TRAINING_TARGET_HIT", playerId: player.id, target: String(mode.checkoutStart) }); else if (bust) events.push({ type: "BUST", playerId: player.id });
    const nextMode = { ...mode, score, hits, attempts, successes: mode.successes + (validCheckout ? 1 : 0), remaining };
    if (!challengeDone) return { state: { ...state, currentTurn: turn, modeState: nextMode, updatedAt: now.toISOString() }, events };
    if (state.currentRound >= mode.maxRounds) return completeSession(state, turn, nextMode, events, now);
    const checkoutStart = generateCheckoutTarget(random); const nextRound = state.currentRound + 1; events.push({ type: "TURN_COMPLETED", turn });
    return { state: { ...state, currentRound: nextRound, currentTurn: makeTurn(player, nextRound, score, now.toISOString()), turns: [...state.turns, turn], modeState: { ...nextMode, checkoutStart, remaining: checkoutStart }, updatedAt: now.toISOString() }, events };
  }

  const target = mode.target; if (!target) throw new Error("Cible d’entraînement introuvable"); const hit = targetHit(dart, target); if (hit) events.push({ type: "TRAINING_TARGET_HIT", playerId: player.id, target: target.label });
  if (mode.trainingType === "random-target") {
    const score = mode.score + (hit ? 1 : 0); const hits = mode.hits + (hit ? 1 : 0); const turnDone = darts.length === 3; const sessionDone = turnDone && state.currentRound >= mode.maxRounds; const turn: Turn = { ...state.currentTurn, darts, scoreAfterTurn: score, turnScore: state.currentTurn.turnScore + (hit ? 1 : 0), isBust: false, isCompleted: turnDone };
    const nextMode = { ...mode, score, hits, attempts, successes: hits, target: sessionDone ? target : generateRandomTarget(random) };
    if (sessionDone) return completeSession(state, turn, nextMode, events, now);
    if (!turnDone) return { state: { ...state, currentTurn: turn, modeState: nextMode, updatedAt: now.toISOString() }, events };
    const nextRound = state.currentRound + 1; events.push({ type: "TURN_COMPLETED", turn }); return { state: { ...state, currentRound: nextRound, currentTurn: makeTurn(player, nextRound, score, now.toISOString()), turns: [...state.turns, turn], modeState: nextMode, updatedAt: now.toISOString() }, events };
  }

  const hitValue = mode.trainingType === "bobs-27" && hit ? state.currentRound * 2 : hit ? 1 : 0; let score = mode.score + hitValue; const hits = mode.hits + (hit ? 1 : 0); const turnDone = darts.length === 3; const turnHits = darts.filter((item) => targetHit(item, target)).length;
  if (mode.trainingType === "bobs-27" && turnDone && turnHits === 0) score -= state.currentRound * 2;
  const sessionDone = turnDone && (state.currentRound >= mode.maxRounds || mode.trainingType === "bobs-27" && score < 0); const turn: Turn = { ...state.currentTurn, darts, scoreAfterTurn: score, turnScore: score - state.currentTurn.scoreBeforeTurn, isBust: mode.trainingType === "bobs-27" && score < 0, isCompleted: turnDone };
  const nextMode = { ...mode, score, hits, attempts, successes: mode.successes + (turnDone && turnHits > 0 ? 1 : 0) };
  if (!turnDone) return { state: { ...state, currentTurn: turn, modeState: nextMode, updatedAt: now.toISOString() }, events };
  if (sessionDone) return completeSession(state, turn, nextMode, events, now);
  const nextRound = state.currentRound + 1; const multiplier = mode.trainingType === "triples" ? 3 : 2; const nextTarget = numberedTarget(nextRound, multiplier); events.push({ type: "TURN_COMPLETED", turn });
  return { state: { ...state, currentRound: nextRound, currentTurn: makeTurn(player, nextRound, score, now.toISOString()), turns: [...state.turns, turn], modeState: { ...nextMode, target: nextTarget }, updatedAt: now.toISOString() }, events };
}
