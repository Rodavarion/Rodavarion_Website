PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS legal_import_runs (
    id TEXT PRIMARY KEY,
    source_system TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_identifier TEXT NOT NULL,
    source_revision TEXT,
    source_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started','completed','failed','skipped')),
    units_imported INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS legal_units (
    id TEXT PRIMARY KEY,
    act_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    parent_id TEXT,
    unit_type TEXT NOT NULL CHECK (
        unit_type IN (
            'preamble','section','chapter','subchapter',
            'article','part','point','subpoint','paragraph','final_provision'
        )
    ),
    unit_number TEXT,
    heading TEXT,
    text_plain TEXT NOT NULL DEFAULT '',
    normalized_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL,
    source_anchor TEXT,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    FOREIGN KEY (revision_id) REFERENCES act_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES legal_units(id) ON DELETE CASCADE,
    UNIQUE (revision_id, path)
);

CREATE TABLE IF NOT EXISTS legal_unit_history (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('created','changed','renumbered','moved','repealed','restored')
    ),
    previous_content_hash TEXT,
    current_content_hash TEXT,
    note TEXT,
    effective_from TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES legal_units(id) ON DELETE CASCADE,
    FOREIGN KEY (revision_id) REFERENCES act_revisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS legal_references (
    id TEXT PRIMARY KEY,
    source_unit_id TEXT NOT NULL,
    target_act_id TEXT,
    target_unit_id TEXT,
    reference_text TEXT NOT NULL,
    reference_kind TEXT NOT NULL DEFAULT 'citation'
        CHECK (reference_kind IN ('citation','amendment','repeal','implementation','definition','other')),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_unit_id) REFERENCES legal_units(id) ON DELETE CASCADE,
    FOREIGN KEY (target_act_id) REFERENCES legal_acts(id) ON DELETE SET NULL,
    FOREIGN KEY (target_unit_id) REFERENCES legal_units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS legal_keywords (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    normalized_keyword TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES legal_units(id) ON DELETE CASCADE,
    UNIQUE (unit_id, normalized_keyword)
);

CREATE INDEX IF NOT EXISTS idx_legal_units_act_order
    ON legal_units(act_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_legal_units_revision_order
    ON legal_units(revision_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_legal_units_parent
    ON legal_units(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_legal_units_type_number
    ON legal_units(unit_type, unit_number);
CREATE INDEX IF NOT EXISTS idx_legal_units_hash
    ON legal_units(content_hash);
CREATE INDEX IF NOT EXISTS idx_legal_import_source
    ON legal_import_runs(source_identifier, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_history_unit
    ON legal_unit_history(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_references_source
    ON legal_references(source_unit_id);
CREATE INDEX IF NOT EXISTS idx_legal_keywords_normalized
    ON legal_keywords(normalized_keyword);

INSERT INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '2.2.0-ukraine-structure-1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP;
