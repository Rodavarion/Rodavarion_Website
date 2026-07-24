PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS legal_act_aliases (
    id TEXT PRIMARY KEY,
    act_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'uk',
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
    UNIQUE (act_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_legal_act_alias_normalized
    ON legal_act_aliases(normalized_alias, weight DESC);

CREATE TABLE IF NOT EXISTS legal_release_state (
    component TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned','ready','active','deprecated')),
    details_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO legal_release_state(component, version, status, details_json)
VALUES (
    'foundation',
    '3.0.0',
    'active',
    '{"jurisdiction":"UA","runtime":"cloudflare-pages-functions","database":"d1"}'
)
ON CONFLICT(component) DO UPDATE SET
    version=excluded.version,
    status=excluded.status,
    details_json=excluded.details_json,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concepts(
    id, jurisdiction, slug, canonical_label, description, concept_kind, status
)
VALUES (
    'ua-concept-constitution',
    'UA',
    'konstytutsiia-ukrainy',
    'Конституція України',
    'Основний Закон України, що має найвищу юридичну силу.',
    'principle',
    'active'
)
ON CONFLICT(id) DO UPDATE SET
    canonical_label=excluded.canonical_label,
    description=excluded.description,
    status='active',
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_aliases(id, concept_id, alias, normalized_alias, language, alias_kind, weight)
VALUES
    ('ua-alias-constitution-1','ua-concept-constitution','Конституція України','конституція україни','uk','term',1.0),
    ('ua-alias-constitution-2','ua-concept-constitution','Конституція','конституція','uk','term',1.0),
    ('ua-alias-constitution-3','ua-concept-constitution','Основний Закон','основний закон','uk','synonym',0.95),
    ('ua-alias-constitution-4','ua-concept-constitution','254к/96-ВР','254к 96 вр','uk','abbreviation',0.9)
ON CONFLICT(concept_id, normalized_alias) DO UPDATE SET
    alias=excluded.alias,
    alias_kind=excluded.alias_kind,
    weight=excluded.weight;

INSERT INTO system_metadata(key, value, updated_at)
VALUES ('schema_version', '3.0.0-foundation-1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;

INSERT INTO system_metadata(key, value, updated_at)
VALUES ('jurisdiction', 'UA', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;
