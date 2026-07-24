PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS app_users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('client','admin')),
 vault_salt TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at INTEGER NOT NULL,
 last_login INTEGER
);
CREATE TABLE IF NOT EXISTS app_sessions(
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 csrf TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS app_admin_mfa(
 user_id INTEGER PRIMARY KEY,
 totp_secret TEXT NOT NULL,
 backup_hashes TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_admin_bootstrap(
 token_hash TEXT PRIMARY KEY,
 expires_at INTEGER NOT NULL,
 username TEXT,
 password_hash TEXT,
 vault_salt TEXT,
 totp_secret TEXT,
 backup_hashes TEXT,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_drafts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title_cipher TEXT NOT NULL,
 text_cipher TEXT NOT NULL,
 iv_title TEXT NOT NULL,
 iv_text TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_drafts_user_updated ON app_drafts(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS app_workspace(
 user_id INTEGER PRIMARY KEY,
 state_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_audit(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event TEXT NOT NULL,
 details TEXT NOT NULL,
 user_id INTEGER,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_app_audit_created ON app_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS app_trusted_sources(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 url TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 created_by INTEGER
);
INSERT OR IGNORE INTO app_trusted_sources(url,label,enabled,created_at)
VALUES
 ('https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80','Конституція України',1,unixepoch()),
 ('https://zakon.rada.gov.ua/laws/main/tt1001','Законодавство України',1,unixepoch());

INSERT INTO system_metadata(key,value,updated_at)
VALUES('private_api','pages-native-rc2',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
