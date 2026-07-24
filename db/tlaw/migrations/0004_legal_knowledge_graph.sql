PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS legal_concepts (
    id TEXT PRIMARY KEY,
    jurisdiction TEXT NOT NULL DEFAULT 'UA',
    slug TEXT NOT NULL UNIQUE,
    canonical_label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    concept_kind TEXT NOT NULL DEFAULT 'legal_concept'
        CHECK (concept_kind IN (
            'legal_concept','right','offence','duty','institution',
            'procedure','remedy','principle','object','status'
        )),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft','active','deprecated')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_concept_aliases (
    id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'uk',
    alias_kind TEXT NOT NULL DEFAULT 'term'
        CHECK (alias_kind IN ('term','synonym','phrase','abbreviation','historical')),
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES legal_concepts(id) ON DELETE CASCADE,
    UNIQUE (concept_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS legal_concept_unit_links (
    id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'related'
        CHECK (relation_type IN (
            'defines','protects','prohibits','limits','implements',
            'references','interprets','supports','conflicts','related'
        )),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    origin TEXT NOT NULL DEFAULT 'editorial'
        CHECK (origin IN ('editorial','rule','import','machine')),
    review_status TEXT NOT NULL DEFAULT 'reviewed'
        CHECK (review_status IN ('candidate','reviewed','rejected')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES legal_concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES legal_units(id) ON DELETE CASCADE,
    UNIQUE (concept_id, unit_id, relation_type)
);

CREATE TABLE IF NOT EXISTS legal_concept_relations (
    id TEXT PRIMARY KEY,
    source_concept_id TEXT NOT NULL,
    target_concept_id TEXT NOT NULL,
    relation_type TEXT NOT NULL
        CHECK (relation_type IN (
            'defines','implements','limits','extends','references',
            'conflicts_with','supported_by','overrides','interpreted_by','related_to'
        )),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    origin TEXT NOT NULL DEFAULT 'editorial'
        CHECK (origin IN ('editorial','rule','import','machine')),
    review_status TEXT NOT NULL DEFAULT 'reviewed'
        CHECK (review_status IN ('candidate','reviewed','rejected')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_concept_id) REFERENCES legal_concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (target_concept_id) REFERENCES legal_concepts(id) ON DELETE CASCADE,
    CHECK (source_concept_id <> target_concept_id),
    UNIQUE (source_concept_id, target_concept_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_legal_concept_alias_normalized
    ON legal_concept_aliases(normalized_alias, weight DESC);
CREATE INDEX IF NOT EXISTS idx_legal_concept_links_concept
    ON legal_concept_unit_links(concept_id, review_status, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_legal_concept_links_unit
    ON legal_concept_unit_links(unit_id, review_status);
CREATE INDEX IF NOT EXISTS idx_legal_concept_relations_source
    ON legal_concept_relations(source_concept_id, review_status);
CREATE INDEX IF NOT EXISTS idx_legal_concept_relations_target
    ON legal_concept_relations(target_concept_id, review_status);

INSERT INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '2.2.0-legal-knowledge-graph-1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO system_metadata (key, value, updated_at)
VALUES ('legal_knowledge_graph', 'enabled', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP;
