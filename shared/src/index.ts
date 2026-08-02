export interface AccountUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
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
  clubId?: string;
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
  clubId?: string;
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

export type ClubRole = "owner" | "admin" | "member";
export type ClubMembershipStatus = "pending" | "active" | "former";

export interface ClubSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: "private" | "public";
  role?: ClubRole;
  membershipStatus?: ClubMembershipStatus;
  memberCount: number;
  profileCount: number;
  createdAt: string;
}

export interface ClubMember {
  userId: string;
  username: string;
  avatar?: string;
  role: ClubRole;
  status: ClubMembershipStatus;
  joinedAt?: string;
}

export interface ClubProfile {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  ownerUserId: string;
  ownerUsername: string;
  kind: "personal" | "guest";
  canManage: boolean;
}

export interface ClubStatisticRow {
  rank: number;
  profileId: string;
  name: string;
  ownerUsername: string;
  kind: "personal" | "guest";
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  dartsThrown: number;
  turnsPlayed: number;
  pointsScored: number;
  averagePerDart: number;
  averagePerTurn: number;
  bestTurn: number;
}

export interface ClubGameMode {
  key: string;
  label: string;
}

export interface ClubStatistics {
  club: { id: string; name: string };
  selectedMode: string;
  modes: ClubGameMode[];
  leaderboard: ClubStatisticRow[];
}

export interface ClubDetail {
  club: ClubSummary & { inviteCode?: string };
  members: ClubMember[];
  profiles: ClubProfile[];
  availableProfiles: ClubProfile[];
}
