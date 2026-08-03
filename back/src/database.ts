import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;
export const pool = new Pool(config.DATABASE_URL
  ? { connectionString: config.DATABASE_URL }
  : {
      host: config.POSTGRES_HOST,
      port: config.POSTGRES_PORT,
      database: config.POSTGRES_DB,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD,
    });

const migration = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_created_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
UPDATE users SET username = 'joueur_' || substring(replace(id, '-', ''), 1, 12) WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(lower(username));

CREATE TABLE IF NOT EXISTS clubs (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL,
  slug varchar(80) NOT NULL UNIQUE,
  description varchar(300) NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  invite_code varchar(32) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS avatar text;

CREATE TABLE IF NOT EXISTS club_members (
  club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('owner','admin','member')),
  status text NOT NULL CHECK(status IN ('pending','active','former')),
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  left_at timestamptz,
  PRIMARY KEY(club_id,user_id)
);
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_status_check;
ALTER TABLE club_members ADD CONSTRAINT club_members_status_check CHECK(status IN ('pending','active','suspended','former'));
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
CREATE INDEX IF NOT EXISTS club_members_user_idx ON club_members(user_id,status);

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(40) NOT NULL,
  normalized_name varchar(40) NOT NULL,
  color text,
  avatar text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_owner_name_unique
  ON profiles(owner_user_id, normalized_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS profiles_updated_idx ON profiles(updated_at);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guest_club_id text;
CREATE INDEX IF NOT EXISTS profiles_guest_club_idx ON profiles(guest_club_id) WHERE guest_club_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_guest_club_fk') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_guest_club_fk FOREIGN KEY(guest_club_id) REFERENCES clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_profiles (
  club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(club_id,profile_id)
);
ALTER TABLE club_profiles ADD COLUMN IF NOT EXISTS avatar text;

CREATE TABLE IF NOT EXISTS club_messages (
  id text PRIMARY KEY,
  club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  author_username varchar(24) NOT NULL,
  content varchar(1000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
ALTER TABLE club_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE club_messages ADD COLUMN IF NOT EXISTS reply_to_message_id text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'club_messages_reply_fk') THEN
    ALTER TABLE club_messages ADD CONSTRAINT club_messages_reply_fk FOREIGN KEY(reply_to_message_id) REFERENCES club_messages(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS club_messages_club_created_idx ON club_messages(club_id,created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS club_message_reactions (
  message_id text NOT NULL REFERENCES club_messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(message_id,user_id,emoji)
);

CREATE TABLE IF NOT EXISTS club_rooms (
  id text PRIMARY KEY,
  club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  host_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scorer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','playing','completed','cancelled')),
  game_state jsonb,
  game_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_rooms_club_idx ON club_rooms(club_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS club_room_viewers (
  room_id text NOT NULL REFERENCES club_rooms(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(room_id,user_id)
);

CREATE TABLE IF NOT EXISTS club_tournaments (
  id text PRIMARY KEY,
  club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  format text NOT NULL CHECK(format IN ('knockout','round-robin')),
  mode_key varchar(60) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_tournament_entries (
  tournament_id text NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  PRIMARY KEY(tournament_id,profile_id),
  UNIQUE(tournament_id,seed)
);

CREATE TABLE IF NOT EXISTS club_tournament_matches (
  id text PRIMARY KEY,
  tournament_id text NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL,
  position integer NOT NULL,
  profile_a_id text REFERENCES profiles(id) ON DELETE SET NULL,
  profile_b_id text REFERENCES profiles(id) ON DELETE SET NULL,
  winner_profile_id text REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed')),
  room_id text REFERENCES club_rooms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id,round,position)
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK(type IN ('club','chat','room','tournament')),
  title varchar(120) NOT NULL,
  body varchar(300) NOT NULL,
  href varchar(300),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS profile_access (
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id, user_id)
);
ALTER TABLE profile_access DROP CONSTRAINT IF EXISTS profile_access_role_check;
UPDATE profile_access SET role = CASE WHEN role = 'editor' THEN 'manager' ELSE 'player' END WHERE role IN ('editor', 'viewer');
ALTER TABLE profile_access ADD CONSTRAINT profile_access_role_check CHECK (role IN ('manager', 'player'));

CREATE TABLE IF NOT EXISTS share_invitations (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, email)
);

CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode_id text NOT NULL,
  status text NOT NULL,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  client_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS games_owner_updated_idx ON games(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS games_leaderboard_idx ON games(mode_id, status) WHERE deleted_at IS NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS club_id text;
CREATE INDEX IF NOT EXISTS games_club_idx ON games(club_id,status) WHERE club_id IS NOT NULL AND deleted_at IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_club_fk') THEN
    ALTER TABLE games ADD CONSTRAINT games_club_fk FOREIGN KEY(club_id) REFERENCES clubs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  replaced_by text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS friendships (
  user_id_a text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_b text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id_a, user_id_b),
  CHECK(user_id_a < user_id_b),
  CHECK(requested_by = user_id_a OR requested_by = user_id_b)
);

CREATE TABLE IF NOT EXISTS game_participants (
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_name varchar(40) NOT NULL,
  darts_thrown integer NOT NULL DEFAULT 0,
  points_scored integer NOT NULL DEFAULT 0,
  best_turn integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  PRIMARY KEY(game_id, profile_id)
);
CREATE INDEX IF NOT EXISTS game_participants_profile_idx ON game_participants(profile_id, game_id);
`;

export async function migrate(): Promise<void> {
  await pool.query(migration);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
