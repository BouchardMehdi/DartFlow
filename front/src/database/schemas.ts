import { X01_STARTING_SCORES } from "@dartflow/shared";
import { z } from "zod";
import { CRICKET_TARGETS } from "@/src/game-engine/cricket-targets";

const x01StartingScoreSchema = z.literal(X01_STARTING_SCORES);
const cricketVariantSchema = z.enum(["standard", "no-score", "cut-throat", "random", "hidden"]);

export const playerSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(40), color: z.string().optional(), avatar: z.string().optional(), order: z.number().int().min(0).max(7), ownerUserId: z.string().optional(), ownerUsername: z.string().optional(), clubProfile: z.boolean().optional() });
export const countUpConfigSchema = z.object({ rounds: z.number().int().min(1).max(99), players: z.array(playerSchema).min(1).max(8) });
export const x01ConfigSchema = z.object({ startingScore: x01StartingScoreSchema, entryRule: z.enum(["straight", "double", "master"]), exitRule: z.enum(["straight", "double", "master"]), rounds: z.number().int().min(1).max(99).nullable(), legsToWin: z.number().int().min(1).max(9), setsToWin: z.number().int().min(1).max(5), players: z.array(playerSchema).min(1).max(8) });
export const aroundTheClockConfigSchema = z.object({ progressionRule: z.enum(["single-only", "any-hit", "multiplier"]), direction: z.enum(["ascending", "descending"]), bullFinish: z.boolean(), rounds: z.number().int().min(1).max(99).nullable(), players: z.array(playerSchema).min(1).max(8) });
export const shanghaiConfigSchema = z.object({ rounds: z.number().int().min(1).max(20), startTarget: z.number().int().min(1).max(20), instantShanghaiWin: z.boolean(), players: z.array(playerSchema).min(1).max(8) }).refine((config) => config.startTarget <= config.rounds);
export const cricketConfigSchema = z.object({ rounds: z.number().int().min(1).max(99).nullable(), variant: cricketVariantSchema, players: z.array(playerSchema).min(1).max(8) });
export const killerConfigSchema = z.object({ lives: z.number().int().min(1).max(5), marksToKiller: z.number().int().min(1).max(5), selfDamage: z.boolean(), players: z.array(playerSchema).min(2).max(8) });
export const trainingConfigSchema = z.object({ trainingType: z.enum(["doubles", "triples", "checkout", "bobs-27", "random-target"]), rounds: z.number().int().min(1).max(50), players: z.array(playerSchema).length(1) });

const dartSchema = z.object({ id: z.string(), segment: z.number().int().min(1).max(20).nullable(), multiplier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), score: z.number().int().min(0).max(60), zone: z.enum(["miss", "single-inner", "single-outer", "double", "triple", "outer-bull", "inner-bull"]), thrownAt: z.string() });
const turnSchema = z.object({ id: z.string(), playerId: z.string(), roundNumber: z.number().int().positive(), darts: z.array(dartSchema).max(3), scoreBeforeTurn: z.number(), scoreAfterTurn: z.number(), turnScore: z.number(), isBust: z.boolean(), isCompleted: z.boolean(), createdAt: z.string() });
const countUpStateSchema = z.object({ kind: z.literal("count-up"), maxRounds: z.number().int().positive(), scores: z.record(z.string(), z.number()) });
const x01StateSchema = z.object({ kind: z.literal("x01"), startingScore: x01StartingScoreSchema, entryRule: z.enum(["straight", "double", "master"]), exitRule: z.enum(["straight", "double", "master"]), maxRounds: z.number().int().positive().nullable(), legsToWin: z.number().int().min(1).max(9).default(1), setsToWin: z.number().int().min(1).max(5).default(1), legStarterIndex: z.number().int().min(0).max(7).default(0), players: z.record(z.string(), z.object({ score: z.number().int().min(0), hasEntered: z.boolean(), legsWon: z.number().int().min(0).max(9).default(0), setsWon: z.number().int().min(0).max(5).default(0) })) });
const aroundTheClockStateSchema = z.object({ kind: z.literal("around-the-clock"), progressionRule: z.enum(["single-only", "any-hit", "multiplier"]), direction: z.enum(["ascending", "descending"]).default("ascending"), bullFinish: z.boolean(), maxRounds: z.number().int().positive().nullable(), players: z.record(z.string(), z.object({ target: z.number().int().min(1).max(21), completed: z.boolean() })) });
const shanghaiStateSchema = z.object({ kind: z.literal("shanghai"), startTarget: z.number().int().min(1).max(20).default(1), maxRounds: z.number().int().min(1).max(20), instantShanghaiWin: z.boolean(), scores: z.record(z.string(), z.number()) });
const cricketTargetSchema = z.union([z.number().int().min(1).max(20), z.literal("bull")]);
const cricketMarksSchema = z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20|bull)$/), z.number().int().min(0).max(3));
const cricketStateSchema = z.object({
  kind: z.literal("cricket"), variant: cricketVariantSchema.default("standard"), maxRounds: z.number().int().positive().nullable(),
  targets: z.array(cricketTargetSchema).length(7).optional(),
  revealedTargets: z.array(cricketTargetSchema).max(7).optional(),
  players: z.record(z.string(), z.object({ score: z.number().min(0), marks: cricketMarksSchema })),
}).superRefine((state, ctx) => {
  const randomized = state.variant === "random" || state.variant === "hidden";
  const targets = state.targets ?? CRICKET_TARGETS;
  const revealed = state.revealedTargets ?? [];
  if ((randomized && !state.targets) || new Set(targets).size !== 7 || !targets.includes("bull") || (!randomized && targets.some(target => !CRICKET_TARGETS.includes(target)))) {
    ctx.addIssue({ code: "custom", path: ["targets"], message: "Sept cibles distinctes dont le bull sont nécessaires." });
  }
  if ((state.variant === "hidden" && !state.revealedTargets) || new Set(revealed).size !== revealed.length || revealed.some(target => !targets.includes(target))) {
    ctx.addIssue({ code: "custom", path: ["revealedTargets"], message: "Découvertes du Cricket invalides." });
  }
  for (const [id, player] of Object.entries(state.players)) {
    if (targets.some(target => player.marks[target] === undefined || (state.variant === "hidden" && (player.marks[target] ?? 0) > 0 && !revealed.includes(target)))) {
      ctx.addIssue({ code: "custom", path: ["players", id, "marks"], message: "Marques du Cricket incomplètes ou incohérentes." });
    }
  }
});
const killerStateSchema = z.object({ kind: z.literal("killer"), startingLives: z.number().int().min(1).max(5), marksToKiller: z.number().int().min(1).max(5).default(3), selfDamage: z.boolean().default(false), players: z.record(z.string(), z.object({ number: z.number().int().min(1).max(20), marks: z.number().int().min(0).max(5), isKiller: z.boolean(), lives: z.number().int().min(0).max(5), eliminated: z.boolean() })) });
const trainingTargetSchema = z.object({ segment: z.number().int().min(1).max(20).nullable(), multiplier: z.union([z.literal(1), z.literal(2), z.literal(3)]), zone: z.enum(["single-inner", "single-outer", "double", "triple", "outer-bull", "inner-bull"]), label: z.string().min(1) });
const trainingStateSchema = z.object({ kind: z.literal("training"), trainingType: z.enum(["doubles", "triples", "checkout", "bobs-27", "random-target"]), maxRounds: z.number().int().min(1).max(50), target: trainingTargetSchema.nullable(), checkoutStart: z.number().int().min(2).max(170).nullable(), remaining: z.number().int().min(0).max(170).nullable(), score: z.number().int(), hits: z.number().int().min(0), attempts: z.number().int().min(0), successes: z.number().int().min(0) });
export const gameStateSchema = z.object({ id: z.string(), modeId: z.enum(["count-up", "x01", "around-the-clock", "shanghai", "cricket", "killer", "training"]), status: z.enum(["setup", "in-progress", "paused", "completed", "cancelled"]), players: z.array(playerSchema).min(1).max(8), currentPlayerIndex: z.number().int().min(0).max(7), currentRound: z.number().int().positive(), currentTurn: turnSchema, turns: z.array(turnSchema), modeState: z.discriminatedUnion("kind", [countUpStateSchema, x01StateSchema, aroundTheClockStateSchema, shanghaiStateSchema, cricketStateSchema, killerStateSchema, trainingStateSchema]), winnerId: z.string().optional(), createdAt: z.string(), updatedAt: z.string(), completedAt: z.string().optional(), clubId: z.string().optional(), clubName: z.string().optional(), liveRoomId: z.string().optional() });
