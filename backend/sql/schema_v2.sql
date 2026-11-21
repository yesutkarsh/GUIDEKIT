-- =====================================================================
-- GuideKit (working name) - Revised schema v2
-- Postgres 15+ with pgvector.
--
-- CHANGELOG vs v1 (for Gemini / reviewers)
-- ---------------------------------------------------------------------
--  A. UNIFIED AUTH: added developers, organizations, org_members,
--     developer_sessions, device_auth_requests. The dashboard and the VS Code
--     extension share one developer identity (extension logs in via a device
--     code flow). The SDK does NOT log in; it only sends a publishable key.
--  B. KEYS: projects.api_key removed. New project_keys table. Publishable keys
--     are PUBLIC (they ship in browser code), so protection comes from
--     project_origins (allowed-origin list) + rate limits + quotas, not secrecy.
--     Secret keys are stored hashed only.
--  C. MULTI-DOMAIN: projects.domain replaced by project_origins
--     (prod, staging, localhost).
--  D. VERSIONING: features now = stable identity; content lives in
--     feature_versions (draft | published | archived). workflow_steps belong
--     to a version. Published versions are immutable (trigger).
--  E. MANIFEST: publishing compiles ONE JSON manifest per project, served from
--     a CDN (published_manifests). The SDK never queries this DB at runtime.
--  F. I18N: localized text + audio live in JSONB keyed by locale
--     (en, hi, ...). Audio is generated at publish time, not at runtime.
--  G. RAG: knowledge_sources / knowledge_chunks (site content Q&A) and
--     feature_embeddings (intent matching) with pgvector. Out-of-scope
--     behaviour is configured in projects.chat_settings.
--  H. STEPS: added advance_on, is_optional, wait_timeout_ms, condition,
--     guide_id. target_fingerprint is now a documented layered locator.
--  I. TOUR STATE: removed chat_sessions.active_feature_id / current_step_order
--     / user_auth_state. Live tour state lives client-side (sessionStorage).
--     DB keeps conversation history + analytics only. Added chat_messages,
--     tour_events.
--  J. SELF-HEALING: step_Resolution_logs renamed step_resolution_logs,
--     time-partitioned, with project_id/dom_hash/timings. AI-healed selectors
--     NEVER overwrite a step; they go to heal_suggestions for developer
--     approval. step_resolution_cache avoids repeat AI calls per (step, dom_hash).
--  K. TENANCY: project_id denormalised onto child tables with composite FKs
--     so cross-tenant references are impossible; RLS for dashboard/extension
--     access. The runtime/SDK path goes through the backend service role.
--  L. OPS: usage counters (project_usage_daily), updated_at triggers, indexes.
--
-- PHASE 1 MANDATORY PATCHES (applied to v2):
--   PATCH 1: developers.password_hash TEXT (legacy nullable column).
--   PATCH 2: projects.framework CHECK expanded to
--            ('react','nextjs','svelte','sveltekit','vue','vanilla').
--            See section 2 below.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector

-- Embedding dimension: 1536 here. Change in ONE place if you pick a different
-- embedding model (e.g. 768 / 1024 / 3072), before any data exists.

-- =====================================================================
-- 1. IDENTITY (unified auth across dashboard + VS Code extension)
-- =====================================================================

CREATE TABLE developers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  display_name      TEXT,
  -- Legacy nullable column retained temporarily; Google is the sole account
  -- authentication method and application code never reads or writes it.
  password_hash     TEXT,
  auth_provider     TEXT NOT NULL DEFAULT 'google',
  auth_provider_id  TEXT,                              -- id in the external IdP, if any
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX developers_email_uq ON developers (lower(email));
CREATE UNIQUE INDEX developers_provider_uq ON developers (auth_provider, auth_provider_id)
  WHERE auth_provider_id IS NOT NULL;

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Tip: on signup, auto-create a personal organization + owner membership.

CREATE TABLE org_members (
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  developer_id  UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, developer_id)
);
CREATE INDEX org_members_developer_idx ON org_members (developer_id);

-- One row per logged-in client (browser dashboard, VS Code extension, CLI).
-- Store only a HASH of the refresh token. Revoke per device.
CREATE TABLE developer_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id        UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  client              TEXT NOT NULL CHECK (client IN ('dashboard','vscode_extension','cli')),
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  device_label        TEXT,                              -- e.g. 'VS Code on MacBook'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ
);
CREATE INDEX developer_sessions_developer_idx ON developer_sessions (developer_id) WHERE revoked_at IS NULL;

-- Device-code login for the VS Code extension (like `gh auth login`):
-- extension requests a code -> opens browser -> developer approves on dashboard
-- -> extension polls and exchanges the device_code for a developer_session.
CREATE TABLE device_auth_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code        TEXT NOT NULL UNIQUE,                 -- short code shown to the human, e.g. 'WXYZ-1234'
  client           TEXT NOT NULL CHECK (client IN ('vscode_extension','cli')),
  developer_id     UUID REFERENCES developers(id) ON DELETE CASCADE,  -- set on approval
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','denied','expired','consumed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL
);

-- =====================================================================
-- 2. PROJECTS, ORIGINS, KEYS
-- =====================================================================

CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,                   -- e.g. 'Taxi Central'
  slug                  TEXT NOT NULL,
  -- PATCH 2: framework CHECK expanded to the full supported framework set.
  framework             TEXT NOT NULL DEFAULT 'nextjs'
                        CHECK (framework IN ('react','nextjs','svelte','sveltekit','vue','vanilla')),
  default_locale        TEXT NOT NULL DEFAULT 'en',
  supported_locales     TEXT[] NOT NULL DEFAULT ARRAY['en'],   -- e.g. {'en','hi'}

  -- How the SDK detects the END USER's login state on the customer's site.
  -- Evaluated in the browser; never trusted for security, only for guiding.
  -- Example:
  --  {"signed_in":  {"type":"cookie","name":"session"},
  --   "alt":        [{"type":"localStorage","key":"token"},
  --                  {"type":"dom","selector":"[data-user-menu]"}],
  --   "role_source":{"type":"localStorage","key":"role"}}
  auth_detection_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- RAG / chat behaviour. Example:
  --  {"out_of_scope_message":"I can only help with Taxi Central.",
  --   "min_similarity":0.72, "max_context_chunks":6, "tts_enabled":true}
  chat_settings         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Dashboard identity and the project's high-level lifecycle stage. This
  -- environment is metadata only; allowed origins keep their own environment.
  environment           TEXT NOT NULL DEFAULT 'development'
                        CHECK (environment IN ('development','staging','production')),
  background_id         TEXT NOT NULL DEFAULT 'untitled-blend',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at           TIMESTAMPTZ,
  UNIQUE (org_id, slug)
);
CREATE INDEX projects_org_idx ON projects (org_id);

-- Allowed origins for a project's PUBLISHABLE key. Backend rejects requests
-- whose Origin header is not listed here.
CREATE TABLE project_origins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin      TEXT NOT NULL,                              -- 'https://taxicentral.com' (scheme+host+port, no path)
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, origin)
);

-- NOTE: a publishable key is PUBLIC by design (it is in the browser bundle /
-- NEXT_PUBLIC_* env var). Secret keys are server-side only, stored hashed.
CREATE TABLE project_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_type     TEXT NOT NULL CHECK (key_type IN ('publishable','secret')),
  key_prefix   TEXT NOT NULL,                             -- e.g. 'pk_live_ab12' (safe to display)
  key_hash     TEXT NOT NULL UNIQUE,                      -- sha256(full key); lookup is by hash
  key_plain    TEXT,                                      -- ONLY for publishable keys (dashboard can re-show)
  label        TEXT,
  created_by   UUID REFERENCES developers(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  CHECK ( (key_type = 'publishable') OR (key_plain IS NULL) )
);
CREATE INDEX project_keys_project_idx ON project_keys (project_id) WHERE revoked_at IS NULL;

-- =====================================================================
-- 3. FEATURES (flows), VERSIONS, STEPS
-- =====================================================================

-- Stable identity of a flow. Content lives in feature_versions.
CREATE TABLE features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                              -- stable key, e.g. 'book-ride'
  created_by  UUID REFERENCES developers(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE (project_id, slug),
  UNIQUE (id, project_id)                                 -- enables composite FKs below
);

CREATE TABLE feature_versions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id              UUID NOT NULL,
  project_id              UUID NOT NULL,
  version_number          INT  NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),

  -- Localized text. Shape:
  --  {"en":{"title":"Book a ride","intent_description":"..."},
  --   "hi":{"title":"राइड बुक करें","intent_description":"..."}}
  content                 JSONB NOT NULL,
  example_queries         TEXT[] NOT NULL DEFAULT '{}',   -- sample user questions, used for matching + embeddings

  requires_auth           BOOLEAN NOT NULL DEFAULT FALSE,
  required_role           TEXT,                           -- 'driver' | 'passenger' | NULL = any
  prerequisite_feature_id UUID,                           -- e.g. the 'login' feature; resolved to its published version at runtime

  created_by              UUID REFERENCES developers(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at            TIMESTAMPTZ,
  published_by            UUID REFERENCES developers(id),

  UNIQUE (feature_id, version_number),
  UNIQUE (id, project_id),
  FOREIGN KEY (feature_id, project_id) REFERENCES features(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_feature_id, project_id) REFERENCES features(id, project_id),
  CHECK (prerequisite_feature_id IS DISTINCT FROM feature_id),
  CHECK (jsonb_typeof(content) = 'object')
);
-- At most one live (published) and one in-progress (draft) version per feature.
CREATE UNIQUE INDEX feature_versions_one_published_uq ON feature_versions (feature_id) WHERE status = 'published';
CREATE UNIQUE INDEX feature_versions_one_draft_uq     ON feature_versions (feature_id) WHERE status = 'draft';
CREATE INDEX feature_versions_project_idx ON feature_versions (project_id, status);

-- Intent matching vectors (one row per version x locale). Most user questions
-- should resolve via vector similarity; the LLM is only a tie-breaker.
CREATE TABLE feature_embeddings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL,
  feature_version_id  UUID NOT NULL,
  locale              TEXT NOT NULL,
  source_text         TEXT NOT NULL,                      -- the text that was embedded
  embedding           VECTOR(1536) NOT NULL,
  UNIQUE (feature_version_id, locale, source_text),
  FOREIGN KEY (feature_version_id, project_id) REFERENCES feature_versions(id, project_id) ON DELETE CASCADE
);
CREATE INDEX feature_embeddings_hnsw ON feature_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX feature_embeddings_project_idx ON feature_embeddings (project_id);

CREATE TABLE workflow_steps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL,
  feature_version_id  UUID NOT NULL,
  step_order          INT  NOT NULL,

  -- Stable id the VS Code AI writes into the developer's source as
  -- data-guide-id="..." (as a reviewed diff). Survives redesigns; primary locator.
  guide_id            TEXT,

  route_pattern       TEXT NOT NULL,                      -- '/driver/dashboard', '/rides/[id]'
  action_type         TEXT NOT NULL CHECK (action_type IN ('click','input','select','navigate','hover','info')),

  -- What lets the tour move to the next step.
  advance_on          TEXT NOT NULL DEFAULT 'click'
                      CHECK (advance_on IN ('click','input_valid','route_change','element_appears','manual_next')),
  is_optional         BOOLEAN NOT NULL DEFAULT FALSE,
  wait_timeout_ms     INT NOT NULL DEFAULT 5000 CHECK (wait_timeout_ms BETWEEN 0 AND 60000),
  condition           JSONB,                              -- optional gate, e.g. {"role":"driver"}; step skipped if not met

  -- Localized popover text + generated audio. Shape:
  --  {"en":{"title":"Click Book","description":"...","audio_url":"https://cdn/..."},
  --   "hi":{"title":"...","description":"...","audio_url":"https://cdn/..."}}
  content             JSONB NOT NULL,

  -- Layered locator, tried top to bottom by the SDK resolver (see below).
  --  {
  --   "guide_id":"book-ride-submit",
  --   "css":"form#booking button[type=submit]",
  --   "role":"button",
  --   "accessible_name":["Book Ride","Book Now"],
  --   "text":["Book Ride"],
  --   "attrs":{"data-testid":"book-submit"},
  --   "landmark":"form[aria-label=Booking]",
  --   "in_shadow_dom":false,
  --   "iframe_path":null
  --  }
  target_fingerprint  JSONB NOT NULL,

  UNIQUE (feature_version_id, step_order),
  UNIQUE (id, project_id),
  FOREIGN KEY (feature_version_id, project_id) REFERENCES feature_versions(id, project_id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(content) = 'object'),
  CHECK (jsonb_typeof(target_fingerprint) = 'object')
);
CREATE INDEX workflow_steps_project_idx ON workflow_steps (project_id);
CREATE INDEX workflow_steps_guide_idx ON workflow_steps (feature_version_id, guide_id);

-- Published versions are immutable: steps can only change while the parent
-- version is a draft.
CREATE FUNCTION forbid_edit_of_non_draft_steps() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM feature_versions
   WHERE id = COALESCE(NEW.feature_version_id, OLD.feature_version_id);
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Steps of a % version are immutable; create a new draft version', v_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER workflow_steps_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON workflow_steps
  FOR EACH ROW EXECUTE FUNCTION forbid_edit_of_non_draft_steps();

-- =====================================================================
-- 4. PUBLISHED MANIFESTS (what the SDK actually loads)
-- =====================================================================
-- Publishing compiles all published feature versions + steps + localized text
-- + audio URLs into ONE JSON file, uploaded to object storage / CDN.
-- SDK: GET <cdn>/<project_id>/manifest.json with ETag. No DB hit at runtime;
-- a DB outage does not break the site.
CREATE TABLE published_manifests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  manifest_version INT  NOT NULL,
  etag             TEXT NOT NULL,                         -- content hash
  storage_key      TEXT NOT NULL,                         -- object key / CDN path
  byte_size        INT,
  feature_count    INT,
  is_current       BOOLEAN NOT NULL DEFAULT TRUE,
  published_by     UUID REFERENCES developers(id),
  published_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, manifest_version)
);
CREATE UNIQUE INDEX published_manifests_current_uq ON published_manifests (project_id) WHERE is_current;

-- =====================================================================
-- 5. RAG KNOWLEDGE (site content Q&A, scoped to the project)
-- =====================================================================

CREATE TABLE knowledge_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('url','markdown','file','code_summary','faq')),
  title         TEXT NOT NULL,
  uri           TEXT,                                     -- URL / file path
  content_hash  TEXT,                                     -- skip re-embedding when unchanged
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','indexed','failed')),
  created_by    UUID REFERENCES developers(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, project_id)
);
CREATE INDEX knowledge_sources_project_idx ON knowledge_sources (project_id);

CREATE TABLE knowledge_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL,
  source_id   UUID NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'en',
  chunk_index INT  NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536) NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_id, chunk_index, locale),
  FOREIGN KEY (source_id, project_id) REFERENCES knowledge_sources(id, project_id) ON DELETE CASCADE
);
CREATE INDEX knowledge_chunks_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunks_project_idx ON knowledge_chunks (project_id, locale);

-- =====================================================================
-- 6. END-USER CHAT (history + analytics only; NOT live tour state)
-- =====================================================================
-- Live tour state (current feature, current step, auth state) lives in the
-- browser's sessionStorage so it survives full page loads without a server
-- round trip. visitor_id is a random id generated by the SDK (no PII).

CREATE TABLE chat_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  visitor_id     TEXT NOT NULL,
  locale         TEXT NOT NULL DEFAULT 'en',
  origin         TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, project_id)
);
CREATE INDEX chat_sessions_project_idx ON chat_sessions (project_id, started_at DESC);
CREATE INDEX chat_sessions_visitor_idx ON chat_sessions (project_id, visitor_id);

CREATE TABLE chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL,
  session_id          UUID NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content             TEXT NOT NULL,
  route_taken         TEXT CHECK (route_taken IN ('feature_match','rag_answer','out_of_scope','smalltalk')),
  matched_feature_version_id UUID,
  similarity          REAL,
  retrieved_chunk_ids UUID[],
  prompt_tokens       INT,
  completion_tokens   INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id, project_id) REFERENCES chat_sessions(id, project_id) ON DELETE CASCADE
);
CREATE INDEX chat_messages_session_idx ON chat_messages (session_id, created_at);
CREATE INDEX chat_messages_project_idx ON chat_messages (project_id, created_at DESC);

-- Tour analytics: where do users drop off?
CREATE TABLE tour_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id          UUID,
  feature_version_id  UUID REFERENCES feature_versions(id) ON DELETE SET NULL,
  step_id             UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL CHECK (event_type IN ('started','step_shown','step_completed','completed','exited','failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tour_events_project_idx ON tour_events (project_id, created_at DESC);
CREATE INDEX tour_events_step_idx ON tour_events (step_id, event_type);

-- =====================================================================
-- 7. SELF-HEALING (runtime resolver)
-- =====================================================================
-- Resolver ladder (client side), stop at first success:
--   1 data-guide-id / stored selector           (~0 ms)
--   2 fingerprint scoring: role+name+text+landmark (no AI)
--   3 LLM picks from a PRUNED list of visible interactive elements
--     (candidate ids only; never raw HTML; never invents selectors)
--   4 text-only instruction
-- The SDK batches these logs (or aggregates locally) before sending.

CREATE TABLE step_resolution_logs (
  id                     UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id                UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL CHECK (status IN ('matched_primary','matched_fingerprint','healed_by_ai','fallback_to_text','cache_hit')),
  resolution_ms          INT,
  page_path              TEXT,                            -- path only; strip query string/hash (privacy)
  dom_hash               TEXT,                            -- hash of the pruned element list
  detected_dom_selector  TEXT,
  logged_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, logged_at)
) PARTITION BY RANGE (logged_at);
CREATE TABLE step_resolution_logs_default PARTITION OF step_resolution_logs DEFAULT;
-- Create monthly partitions (pg_partman or a cron job) and drop old ones to bound size.
CREATE INDEX step_resolution_logs_step_idx ON step_resolution_logs (step_id, logged_at DESC);
CREATE INDEX step_resolution_logs_project_idx ON step_resolution_logs (project_id, status, logged_at DESC);

-- AI-found selectors are SUGGESTIONS. A developer approves them (extension or
-- dashboard); approval writes a new draft version. Prevents one bad AI guess
-- from poisoning a flow for every user.
CREATE TABLE heal_suggestions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id                UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  suggested_fingerprint  JSONB NOT NULL,
  suggested_selector     TEXT,
  confidence             REAL,
  occurrences            INT NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  first_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by            UUID REFERENCES developers(id),
  reviewed_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX heal_suggestions_open_uq ON heal_suggestions (step_id, suggested_selector) WHERE status = 'pending';
CREATE INDEX heal_suggestions_project_idx ON heal_suggestions (project_id, status);

-- Server-side cache so a given break costs ONE AI call, not one per visitor.
CREATE TABLE step_resolution_cache (
  step_id            UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  dom_hash           TEXT NOT NULL,
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resolved_candidate JSONB NOT NULL,                      -- chosen candidate descriptor, not raw HTML
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (step_id, dom_hash)
);

-- =====================================================================
-- 8. USAGE / QUOTAS (rate limiting itself belongs in Redis/edge)
-- =====================================================================
CREATE TABLE project_usage_daily (
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day             DATE NOT NULL,
  chat_messages   INT NOT NULL DEFAULT 0,
  ai_resolutions  INT NOT NULL DEFAULT 0,
  tts_characters  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, day)
);

-- =====================================================================
-- 9. updated_at TRIGGERS
-- =====================================================================
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['developers','organizations','projects','feature_versions','knowledge_sources']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t || '_updated_at', t);
  END LOOP;
END $$;

-- =====================================================================
-- 10. ROW LEVEL SECURITY (dashboard + VS Code extension access)
-- =====================================================================
-- The backend sets `SET LOCAL app.current_developer_id = '<uuid>'` per request
-- after validating the developer's token. The SDK / end-user runtime path goes
-- through the backend with the service role (which bypasses RLS) after
-- validating publishable key + Origin; end users never touch these tables.

CREATE FUNCTION current_developer_id() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_developer_id', TRUE), '')::UUID
$$;

CREATE FUNCTION has_project_access(p_project_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN org_members m ON m.org_id = p.org_id
    WHERE p.id = p_project_id AND m.developer_id = current_developer_id()
  )
$$;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_member_access ON projects
  USING (EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = projects.org_id AND m.developer_id = current_developer_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = projects.org_id AND m.developer_id = current_developer_id()));

-- Developer-editable tables: full access for project members.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_origins','project_keys','features','feature_versions','feature_embeddings',
    'workflow_steps','published_manifests','knowledge_sources','knowledge_chunks','heal_suggestions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (has_project_access(project_id)) WITH CHECK (has_project_access(project_id))', t);
  END LOOP;
END $$;

-- Runtime/analytics tables: written by the backend only; developers can read.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_sessions','chat_messages','tour_events','step_resolution_logs',
    'step_resolution_cache','project_usage_daily'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY developer_read ON %I FOR SELECT USING (has_project_access(project_id))', t);
  END LOOP;
END $$;
