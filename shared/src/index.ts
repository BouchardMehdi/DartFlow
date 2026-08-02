export interface AccountUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export type ProfileRole = "owner" | "manager" | "player";

export interface CloudProfile {
  id: string;
  name: string;
  normalizedName: string;
  color?: string;
  avatar?: string;
  isPublic: boolean;
  role: ProfileRole;
  ownerUserId: string;
  ownerUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudGame {
  id: string;
  modeId: string;
  status: string;
  state: unknown;
  version: number;
  ownerUserId: string;
  updatedAt: string;
}

export interface ProfileSyncInput {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  updatedAt: string;
}

export interface GameSyncInput {
  id: string;
  modeId: string;
  status: string;
  state: unknown;
  updatedAt: string;
}

export interface SyncRequest {
  profiles: ProfileSyncInput[];
  games: GameSyncInput[];
  deletedGameIds: string[];
}

export interface SyncResponse {
  profiles: CloudProfile[];
  games: CloudGame[];
  profileIdMappings: Record<string, string>;
  syncedAt: string;
}

export interface ProfileShare {
  userId: string;
  username: string;
  role: ProfileRole;
}

export interface FriendSummary {
  userId: string;
  username: string;
  since: string;
}

export interface FriendRequest {
  userId: string;
  username: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
}

export interface FriendsResponse {
  friends: FriendSummary[];
  requests: FriendRequest[];
}

export interface LeaderboardRow {
  rank: number;
  profileId: string;
  name: string;
  ownerUsername: string;
  games: number;
  wins: number;
  winRate: number;
  dartsThrown: number;
  averagePerDart: number;
  bestTurn: number;
}
