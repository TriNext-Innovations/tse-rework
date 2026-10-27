-- TSE creative agency — initial schema.
-- Every stage is a durable state transition on these tables, so any n8n
-- execution can die mid-way and the next tick resumes from the database.

CREATE TABLE IF NOT EXISTS settings (
    key        text PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text NOT NULL DEFAULT 'system'
);

-- Weekly campaign: one proposition, many executions.
CREATE TABLE IF NOT EXISTS campaigns (
    id             bigserial PRIMARY KEY,
    week_start     date NOT NULL UNIQUE,          -- Monday, SAST
    name           text NOT NULL,
    proposition    text NOT NULL,
    insight        text NOT NULL,
    brief          jsonb NOT NULL,                 -- full strategist output
    prompt_version text NOT NULL,
    status         text NOT NULL DEFAULT 'active'  -- active | closed
        CHECK (status IN ('active', 'closed')),
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- One assignment per publishing slot. The strategist writes the angle;
-- the copywriter and creative director turn it into a concept.
CREATE TABLE IF NOT EXISTS assignments (
    id            bigserial PRIMARY KEY,
    campaign_id   bigint NOT NULL REFERENCES campaigns(id),
    slot_at       timestamptz NOT NULL UNIQUE,     -- the publishing slot this feeds
    pillar        text NOT NULL                    -- brand | product | educational | commercial
        CHECK (pillar IN ('brand', 'product', 'educational', 'commercial')),
    angle         text NOT NULL,
    audience      text NOT NULL,
    format        text NOT NULL DEFAULT 'image' CHECK (format IN ('image', 'video')),
    status        text NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'developing', 'concept_ready', 'in_production',
                          'produced', 'approved', 'failed', 'cancelled')),
    attempts      int  NOT NULL DEFAULT 0,         -- creative-development rounds used
    locked_by     text,
    locked_at     timestamptz,
    last_error    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_status_idx ON assignments (status, slot_at);

-- Every concept the copywriter wrote, kept whether chosen or not: this is
-- the creative memory the repetition checks read.
CREATE TABLE IF NOT EXISTS concepts (
    id             bigserial PRIMARY KEY,
    assignment_id  bigint NOT NULL REFERENCES assignments(id),
    round          int NOT NULL,
    idea           text NOT NULL,
    insight        text NOT NULL,
    headline       text NOT NULL,
    support_line   text,
    visual         text NOT NULL,
    territory      text NOT NULL,                   -- short tag, e.g. "luxury-parody"
    claims         jsonb NOT NULL DEFAULT '[]',     -- verified fact ids the copy relies on
    data           jsonb NOT NULL,                  -- full copywriter output
    review         jsonb,                           -- creative-director scores
    status         text NOT NULL DEFAULT 'candidate'
        CHECK (status IN ('candidate', 'selected', 'rejected')),
    rejection      text,
    prompt_version text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    search         tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(headline, '') || ' ' || coalesce(support_line, '') || ' ' ||
                               coalesce(idea, '') || ' ' || coalesce(insight, '') || ' ' ||
                               coalesce(visual, '') || ' ' || coalesce(territory, ''))
    ) STORED
);
CREATE INDEX IF NOT EXISTS concepts_search_idx ON concepts USING gin (search);
CREATE INDEX IF NOT EXISTS concepts_assignment_idx ON concepts (assignment_id);

-- A produced execution of a selected concept. Regeneration creates a new
-- row, so rejected attempts stay in the history.
CREATE TABLE IF NOT EXISTS creatives (
    id              bigserial PRIMARY KEY,
    assignment_id   bigint NOT NULL REFERENCES assignments(id),
    concept_id      bigint NOT NULL REFERENCES concepts(id),
    attempt         int NOT NULL,
    art_brief       jsonb NOT NULL,
    image_prompt    text NOT NULL,
    model           text NOT NULL,
    layout          text NOT NULL,
    caption_facebook  text NOT NULL,
    caption_instagram text NOT NULL,
    link_url        text,                           -- with UTM parameters
    raw_asset       text,                           -- storage key of the generated plate
    final_asset     text,                           -- storage key of the branded JPEG
    final_sha256    text,
    width           int,
    height          int,
    status          text NOT NULL DEFAULT 'art_directed'
        CHECK (status IN ('art_directed', 'generating', 'generated', 'rendered',
                          'approved', 'rejected', 'failed', 'budget_blocked')),
    human_approval  text CHECK (human_approval IN ('approved', 'rejected')),
    human_note      text,
    last_error      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, attempt)
);
CREATE INDEX IF NOT EXISTS creatives_status_idx ON creatives (status);

CREATE TABLE IF NOT EXISTS generation_jobs (
    id            bigserial PRIMARY KEY,
    creative_id   bigint NOT NULL REFERENCES creatives(id),
    provider      text NOT NULL,
    model         text NOT NULL,
    request_id    text,                             -- provider queue id; resumable
    status        text NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'submitted', 'completed', 'failed', 'cancelled')),
    est_cost_usd  numeric(10, 4) NOT NULL,
    input         jsonb NOT NULL,
    output        jsonb,
    error         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS generation_jobs_open_idx ON generation_jobs (status) WHERE status IN ('reserved', 'submitted');

CREATE TABLE IF NOT EXISTS qc_reviews (
    id          bigserial PRIMARY KEY,
    creative_id bigint NOT NULL REFERENCES creatives(id),
    kind        text NOT NULL CHECK (kind IN ('deterministic', 'vision', 'human')),
    passed      boolean NOT NULL,
    score       numeric(5, 2),
    findings    jsonb NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Publishing slots: each slot owns at most one creative and each creative
-- fills at most one slot.
CREATE TABLE IF NOT EXISTS schedule (
    slot_at      timestamptz PRIMARY KEY,
    creative_id  bigint UNIQUE REFERENCES creatives(id),
    status       text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'filled', 'publishing', 'done', 'partial', 'failed', 'skipped')),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per creative per platform: the UNIQUE constraint is what makes
-- a duplicate publication structurally impossible.
CREATE TABLE IF NOT EXISTS publications (
    id            bigserial PRIMARY KEY,
    creative_id   bigint NOT NULL REFERENCES creatives(id),
    platform      text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
    slot_at       timestamptz NOT NULL,
    mode          text NOT NULL CHECK (mode IN ('dry_run', 'live')),
    status        text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'published', 'failed', 'dry_run', 'unknown')),
    attempts      int NOT NULL DEFAULT 0,
    container_id  text,                             -- Instagram media container
    external_id   text,                             -- FB post_id / IG media id
    permalink     text,
    request       jsonb,
    response      jsonb,
    error         text,
    run_id        text,
    started_at    timestamptz,
    published_at  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (creative_id, platform)
);

CREATE TABLE IF NOT EXISTS post_metrics (
    id              bigserial PRIMARY KEY,
    publication_id  bigint NOT NULL REFERENCES publications(id),
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    reach           int,
    impressions     int,
    engagements     int,
    reactions       int,
    comments        int,
    shares          int,
    saves           int,
    link_clicks     int,
    raw             jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS post_metrics_pub_idx ON post_metrics (publication_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS performance_reports (
    id          bigserial PRIMARY KEY,
    week_start  date NOT NULL UNIQUE,
    summary     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Money. Visual generation and Claude are separate categories with
-- separate limits; reservations are written before a provider call.
CREATE TABLE IF NOT EXISTS spend_ledger (
    id          bigserial PRIMARY KEY,
    category    text NOT NULL CHECK (category IN ('visual', 'llm')),
    provider    text NOT NULL,
    model       text NOT NULL,
    amount_usd  numeric(10, 5) NOT NULL,
    kind        text NOT NULL CHECK (kind IN ('reservation', 'actual', 'release')),
    ref         text,
    detail      jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spend_ledger_month_idx ON spend_ledger (category, created_at);

CREATE TABLE IF NOT EXISTS events (
    id         bigserial PRIMARY KEY,
    run_id     text,
    stage      text NOT NULL,
    level      text NOT NULL CHECK (level IN ('info', 'warn', 'error', 'alert')),
    message    text NOT NULL,
    data       jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_level_idx ON events (level, created_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

-- Result of re-fetching each fact's source page and finding its evidence.
CREATE TABLE IF NOT EXISTS fact_checks (
    fact_id    text PRIMARY KEY,
    ok         boolean NOT NULL,
    detail     text,
    checked_at timestamptz NOT NULL DEFAULT now()
);

-- Alerts are claimed by the monitoring workflow exactly once.
ALTER TABLE events ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS events_unnotified_idx ON events (id) WHERE level = 'alert' AND notified_at IS NULL;
