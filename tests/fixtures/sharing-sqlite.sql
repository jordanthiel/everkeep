CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE vaults (id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE memberships (vault_id TEXT NOT NULL REFERENCES vaults(id), email TEXT NOT NULL, scope TEXT NOT NULL, can_edit INTEGER NOT NULL, status TEXT NOT NULL, email_status TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(vault_id, email));
CREATE TABLE invitations (request_id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, email TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE audit (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
CREATE INDEX memberships_email ON memberships(email, status);
CREATE INDEX audit_vault ON audit(vault_id, created_at);
