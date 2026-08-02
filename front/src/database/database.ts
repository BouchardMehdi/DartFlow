import Dexie, { type EntityTable } from "dexie";
import type { GameState, Player } from "@/src/game-engine/types";

export interface SavedGame extends GameState { savedAt: string; cloudUserId?: string; cloudVersion?: number; }
export interface SavedPlayer extends Player { createdAt: string; updatedAt: string; cloudUserId?: string; cloudRole?: "owner" | "editor" | "viewer"; ownerEmail?: string; isPublic?: boolean; }
export interface SavedSettings { id: "main"; animations: boolean; sound: boolean; }
export interface SyncOutboxItem { id: string; entityType: "game"; entityId: string; action: "delete"; createdAt: string; }
export interface SyncMetadata { id: "main"; lastSyncedAt?: string; lastError?: string; }

export const database = new Dexie("dartflow") as Dexie & {
  players: EntityTable<SavedPlayer, "id">;
  games: EntityTable<SavedGame, "id">;
  settings: EntityTable<SavedSettings, "id">;
  syncOutbox: EntityTable<SyncOutboxItem, "id">;
  syncMetadata: EntityTable<SyncMetadata, "id">;
};
database.version(1).stores({ players: "id, name, createdAt, updatedAt", games: "id, modeId, status, createdAt, completedAt, winnerId", settings: "id" });
database.version(2).stores({ players: "id, name, createdAt, updatedAt, cloudUserId", games: "id, modeId, status, createdAt, completedAt, winnerId, cloudUserId", settings: "id", syncOutbox: "id, entityType, entityId, action, createdAt", syncMetadata: "id" });
