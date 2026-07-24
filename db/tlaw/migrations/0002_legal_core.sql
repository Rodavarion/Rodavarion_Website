PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS legal_acts (
    id TEXT PRIMARY KEY,
    act_type TEXT NOT NULL,
    title TEXT NOT NULL,
    short_title TEXT,
    act_number TEXT,
    issuer TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','adopted','effective','suspended','expired','repealed')),
    adopted_on TEXT,
    effective_from TEXT,
    effective_to TEXT,
    official_url TEXT,
    language TEXT NOT NULL DEFAULT 'uk',
    current_revision_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS act_revisions (
    id TEXT PRIMARY KEY,
    act_id TEXT NOT NULL,
    revision_number INTEGER NOT NULL,
    valid_from TEXT,
    valid_to TEXT,
    source_url TEXT,
    source_hash TEXT,
    text_plain TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    UNIQUE (act_id, revision_number)
);

CREATE TABLE IF NOT EXISTS act_relations (
    id TEXT PRIMARY KEY,
    source_act_id TEXT NOT NULL,
    target_act_id TEXT NOT NULL,
    relation_type TEXT NOT NULL
        CHECK (relation_type IN ('amends','repeals','implements','references','supersedes','conflicts_with')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    FOREIGN KEY (target_act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    UNIQUE (source_act_id, target_act_id, relation_type)
);

CREATE TABLE IF NOT EXISTS legal_conflicts (
    id TEXT PRIMARY KEY,
    higher_act_id TEXT NOT NULL,
    lower_act_id TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'detected'
        CHECK (status IN ('detected','under_review','confirmed','rejected','resolved')),
    detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    FOREIGN KEY (higher_act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    FOREIGN KEY (lower_act_id) REFERENCES legal_acts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legal_acts_type ON legal_acts(act_type);
CREATE INDEX IF NOT EXISTS idx_legal_acts_status ON legal_acts(status);
CREATE INDEX IF NOT EXISTS idx_legal_acts_number ON legal_acts(act_number);
CREATE INDEX IF NOT EXISTS idx_legal_acts_title ON legal_acts(title);
CREATE INDEX IF NOT EXISTS idx_legal_acts_effective_from ON legal_acts(effective_from);
CREATE INDEX IF NOT EXISTS idx_act_revisions_act ON act_revisions(act_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_relations_source ON act_relations(source_act_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON act_relations(target_act_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_higher ON legal_conflicts(higher_act_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_lower ON legal_conflicts(lower_act_id);

INSERT INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '2.1.0-legal-core-1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP;
