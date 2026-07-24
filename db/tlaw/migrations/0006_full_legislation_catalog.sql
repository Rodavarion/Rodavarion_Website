PRAGMA foreign_keys = ON;

ALTER TABLE legal_acts ADD COLUMN source_system TEXT NOT NULL DEFAULT 'tlaw';
ALTER TABLE legal_acts ADD COLUMN source_identifier TEXT;
ALTER TABLE legal_acts ADD COLUMN catalog_imported_at TEXT;
ALTER TABLE legal_acts ADD COLUMN text_import_status TEXT NOT NULL DEFAULT 'missing'
  CHECK (text_import_status IN ('missing','queued','importing','complete','failed','metadata_only'));
ALTER TABLE legal_acts ADD COLUMN source_payload_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_legal_acts_source_identity
  ON legal_acts(source_system, source_identifier)
  WHERE source_identifier IS NOT NULL;

CREATE TABLE IF NOT EXISTS legal_import_queue (
  id TEXT PRIMARY KEY,
  act_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','running','completed','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  not_before TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (act_id) REFERENCES legal_acts(id) ON DELETE CASCADE,
  UNIQUE (act_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_import_queue_state_priority
  ON legal_import_queue(state, priority, created_at);

INSERT INTO system_metadata(key,value,updated_at)
VALUES ('catalog_source','Verkhovna Rada of Ukraine Open Data',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;

INSERT INTO system_metadata(key,value,updated_at)
VALUES ('schema_version','3.2.0-production-preparation-rc1',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
