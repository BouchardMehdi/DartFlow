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
export type ClubMembershipStatus = "pending" | "active" | "suspended" | "former";

export interface ClubSummary {
  id: string;
  name: string;
  avatar?: string;
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
  suspendedUntil?: string;
}

export interface ClubProfile {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  hasCustomAvatar: boolean;
  ownerUserId: string;
  ownerUsername: string;
  kind: "personal" | "guest";
  canManage: boolean;
}

export interface ClubStatisticRow {
  rank: number;
  profileId: string;
  name: string;
  avatar?: string;
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
  scores100Plus: number;
  scores140Plus: number;
  scores180: number;
  doublesHit: number;
  triplesHit: number;
  bullsHit: number;
  highestCheckout: number;
  favoriteSector?: number;
  recentForm: Array<{ date: string; averagePerDart: number }>;
}

export interface ClubGameMode {
  key: string;
  label: string;
}

export interface ClubStatistics {
  club: { id: string; name: string; avatar?: string };
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

export interface ClubMessage {
  id: string;
  clubId: string;
  authorUserId?: string;
  authorUsername: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  canModify: boolean;
  replyTo?: { id: string; authorUsername: string; content: string };
  reactions: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
}

export interface ClubChat {
  club: { id: string; name: string; avatar?: string };
  messages: ClubMessage[];
  authorAvatars: Record<string, string>;
}

export type ClubRoomStatus = "waiting" | "playing" | "completed" | "cancelled";

export interface ClubRoom {
  id: string;
  clubId: string;
  clubName: string;
  name: string;
  status: ClubRoomStatus;
  hostUserId: string;
  hostUsername: string;
  scorerUserId: string;
  scorerUsername: string;
  gameState?: unknown;
  gameVersion: number;
  viewerCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TournamentFormat = "knockout" | "round-robin";
export type TournamentStatus = "draft" | "active" | "completed" | "cancelled";

export interface ClubTournamentEntry {
  profileId: string;
  name: string;
  avatar?: string;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface ClubTournamentMatch {
  id: string;
  round: number;
  position: number;
  profileA?: { id: string; name: string; avatar?: string };
  profileB?: { id: string; name: string; avatar?: string };
  winnerProfileId?: string;
  status: "scheduled" | "completed";
  roomId?: string;
}

export interface ClubTournament {
  id: string;
  clubId: string;
  name: string;
  format: TournamentFormat;
  modeKey: string;
  status: TournamentStatus;
  createdByUsername: string;
  entries: ClubTournamentEntry[];
  matches: ClubTournamentMatch[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: "club" | "chat" | "room" | "tournament";
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export type RealtimeEvent =
  | { type: "chat.changed"; clubId: string }
  | { type: "chat.typing"; clubId: string; userId: string; username: string; typing: boolean }
  | { type: "room.changed"; clubId: string; roomId: string }
  | { type: "tournament.changed"; clubId: string; tournamentId: string }
  | { type: "club.changed"; clubId: string }
  | { type: "notification.created"; notification: NotificationItem };
