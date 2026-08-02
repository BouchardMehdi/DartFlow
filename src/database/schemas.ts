import { z } from "zod";

export const playerSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(40), color: z.string().optional(), avatar: z.string().optional(), order: z.number().int().min(0).max(7) });
export const countUpConfigSchema = z.object({ rounds: z.number().int().min(1).max(99), players: z.array(playerSchema).min(1).max(8) });
