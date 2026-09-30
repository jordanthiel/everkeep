CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE vaults (id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE memberships (vault_id TEXT NOT NULL REFERENCES vaults(id), email TEXT NOT NULL, scope TEXT NOT NULL, can_edit INTEGER NOT NULL, status TEXT NOT NULL, email_status TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(vault_id, email));
CREATE TABLE invitations (request_id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, email TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE audit (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
CREATE INDEX memberships_email ON memberships(email, status);
CREATE INDEX audit_vault ON audit(vault_id, created_at);
CREATE TABLE file_packages (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL REFERENCES vaults(id), keys_payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX file_packages_vault ON file_packages(vault_id);
CREATE TABLE owner_vault_keys (vault_id TEXT PRIMARY KEY REFERENCES vaults(id), key_payload TEXT NOT NULL);
CREATE TABLE billing_orders (
  session_id TEXT PRIMARY KEY,
  payment_intent TEXT NOT NULL,
  email TEXT NOT NULL,
  account_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX billing_orders_email ON billing_orders(email);
CREATE INDEX billing_orders_account ON billing_orders(account_id);
CREATE TABLE billing_payment_blocks (payment_intent TEXT PRIMARY KEY, reason TEXT NOT NULL);
