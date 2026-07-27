-- CLOUD — initial schema (Phase 0 + Phase 1 additions)
--
-- Conventions:
--   * All tenant-scoped tables carry `organization_id UUID NOT NULL` with a FK to
--     `organizations` and an index. The application layer rejects queries missing
--     this predicate (ADR-0009).
--   * All timestamps use `TIMESTAMPTZ` at UTC, default `now()`.
--   * Identity columns use UUIDv4 via `gen_random_uuid()`.
--   * IDs from app code are inserted explicitly; default is fallback for tests.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────── Organizations ─────────────────────────────────────

CREATE TABLE organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizations_slug_idx ON organizations(slug);

-- ───────────────────────── Users ────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INVITED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX users_email_idx ON users(email);

-- ───────────────────────── Memberships (tenant boundary) ───────────────────

CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL
                  CHECK (role IN (
                    'OWNER', 'ADMIN', 'PLATFORM_ENGINEER', 'DEVOPS', 'SRE',
                    'SECURITY', 'FINOPS', 'DEVELOPER', 'VIEWER'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX memberships_user_id_idx ON memberships(user_id);
CREATE INDEX memberships_organization_id_idx ON memberships(organization_id);

-- ───────────────────────── Sessions ─────────────────────────────────────────

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT,
  token_hash      TEXT NOT NULL UNIQUE,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);

-- ───────────────────────── Audit events (append-only) ───────────────────────

CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  before_state    JSONB,
  after_state     JSONB,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip              TEXT,
  correlation_id  TEXT NOT NULL
);

CREATE INDEX audit_events_org_idx    ON audit_events(organization_id, timestamp DESC);
CREATE INDEX audit_events_actor_idx  ON audit_events(actor_id, timestamp DESC);
CREATE INDEX audit_events_corrid_idx ON audit_events(correlation_id);

-- ───────────────────────── Event log (internal bus persistence) ─────────────

CREATE TABLE events (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  type            TEXT NOT NULL,
  version         INT NOT NULL,
  source          TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  correlation_id  TEXT NOT NULL,
  causation_id    TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  payload         JSONB NOT NULL
);

CREATE INDEX events_org_type_idx     ON events(organization_id, type, occurred_at DESC);
CREATE INDEX events_correlation_idx  ON events(correlation_id);

-- ───────────────────────── Migrations ledger ───────────────────────────────

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);