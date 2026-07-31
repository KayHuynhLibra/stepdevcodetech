-- 100x Phase 1 core schema (Postgres)
-- Applied by server/scripts/db-migrate.mjs when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_snapshot (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  code TEXT,
  role TEXT,
  balance BIGINT NOT NULL DEFAULT 0,
  gem BIGINT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_snapshot_username ON users_snapshot (username);
CREATE INDEX IF NOT EXISTS idx_users_snapshot_code ON users_snapshot (code);

CREATE TABLE IF NOT EXISTS vault_ledger (
  id TEXT PRIMARY KEY,
  vault_key TEXT NOT NULL DEFAULT 'tarot',
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  balance_after BIGINT,
  user_id TEXT,
  by_username TEXT,
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_vault_ledger_vault_at ON vault_ledger (vault_key, at DESC);

CREATE TABLE IF NOT EXISTS stakes (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  username TEXT,
  round INT,
  card_id INT,
  amount BIGINT NOT NULL DEFAULT 0,
  result TEXT,
  payout BIGINT,
  profit BIGINT,
  winning_card_id INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stakes_user_at ON stakes (user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_stakes_at ON stakes (at DESC);

CREATE TABLE IF NOT EXISTS oracle_decks (
  id TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  blurb TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oracle_cards (
  key TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES oracle_decks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  number INT NOT NULL DEFAULT 0,
  suit TEXT,
  element TEXT,
  upright TEXT NOT NULL DEFAULT '',
  reversed TEXT NOT NULL DEFAULT '',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  image TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 0,
  blurb TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_cards_deck ON oracle_cards (deck_id, sort);

CREATE TABLE IF NOT EXISTS oracle_draws (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  spread TEXT NOT NULL,
  cards JSONB NOT NULL,
  question TEXT,
  notes TEXT,
  title TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_draws_user ON oracle_draws (user_id, at DESC);

ALTER TABLE oracle_draws ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE oracle_draws ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE oracle_draws ADD COLUMN IF NOT EXISTS title TEXT;
