import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;
export const pool = new Pool({ connectionString: config.DATABASE_URL });

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
