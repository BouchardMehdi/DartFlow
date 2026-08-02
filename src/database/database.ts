import Dexie, { type EntityTable } from "dexie";
import type { GameState, Player } from "@/src/game-engine/types";

export interface SavedGame extends GameState { savedAt: string; }
export interface SavedPlayer extends Player { createdAt: string; updatedAt: string; }
export interface SavedSettings { id: "main"; animations: boolean; sound: boolean; }

export const database = new Dexie("dartflow") as Dexie & {
  players: EntityTable<SavedPlayer, "id">;
  games: EntityTable<SavedGame, "id">;
  settings: EntityTable<SavedSettings, "id">;
};
database.version(1).stores({ players: "id, name, createdAt, updatedAt", games: "id, modeId, status, createdAt, completedAt, winnerId", settings: "id" });
