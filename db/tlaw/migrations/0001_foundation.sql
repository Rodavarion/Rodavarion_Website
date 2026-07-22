PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS official_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    legal_rank INTEGER NOT NULL,
    source_url TEXT NOT NULL,
    source_host TEXT NOT NULL,
    adoption_date TEXT,
    current_revision_date TEXT,
    document_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    verified_at INTEGER NOT NULL,
    immutable INTEGER NOT NULL DEFAULT 1
        CHECK (immutable IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_documents_status
    ON official_documents(status);

CREATE INDEX IF NOT EXISTS idx_documents_rank
    ON official_documents(legal_rank);

CREATE INDEX IF NOT EXISTS idx_documents_revision
    ON official_documents(current_revision_date);

CREATE TABLE IF NOT EXISTS document_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    revision_date TEXT,
    status TEXT,
    source_url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    document_text TEXT NOT NULL,
    imported_at INTEGER NOT NULL,
    UNIQUE(document_id, content_hash),
    FOREIGN KEY(document_id)
        REFERENCES official_documents(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trusted_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
        CHECK (enabled IN (0, 1)),
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    details_json TEXT NOT NULL,
    actor_id TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_log(created_at DESC);

INSERT INTO system_metadata(key, value, updated_at)
VALUES (
    'schema_version',
    '2.0.0-foundation-1',
    CAST(strftime('%s', 'now') AS INTEGER)
)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at;

INSERT INTO system_metadata(key, value, updated_at)
VALUES (
    'platform',
    'cloudflare-native',
    CAST(strftime('%s', 'now') AS INTEGER)
)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at;
