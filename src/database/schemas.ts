import { z } from "zod";

export const playerSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(40), color: z.string().optional(), avatar: z.string().optional(), order: z.number().int().min(0).max(7) });
export const countUpConfigSchema = z.object({ rounds: z.number().int().min(1).max(99), players: z.array(playerSchema).min(1).max(8) });
export const x01ConfigSchema = z.object({ startingScore: z.union([z.literal(301), z.literal(501), z.literal(701)]), entryRule: z.enum(["straight", "double", "master"]), exitRule: z.enum(["straight", "double", "master"]), rounds: z.number().int().min(1).max(99).nullable(), players: z.array(playerSchema).min(1).max(8) });
