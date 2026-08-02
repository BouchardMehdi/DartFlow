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

CREATE TABLE IF NOT EXISTS profile_access (
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id, user_id)
);

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
`;

export async function migrate(): Promise<void> {
  await pool.query(migration);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
