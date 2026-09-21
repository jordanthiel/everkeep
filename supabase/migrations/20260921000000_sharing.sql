CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE vaults (id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE memberships (vault_id TEXT NOT NULL REFERENCES vaults(id), email TEXT NOT NULL, scope TEXT NOT NULL, can_edit INTEGER NOT NULL, status TEXT NOT NULL, email_status TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(vault_id, email));
CREATE TABLE invitations (request_id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, email TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE audit (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
CREATE INDEX memberships_email ON memberships(email, status);
CREATE INDEX audit_vault ON audit(vault_id, created_at);

-- No direct client reads: the API decrypts and returns only the granted records.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vaults FROM anon, authenticated;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memberships FROM anon, authenticated;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM anon, authenticated;
ALTER TABLE public.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('everkeep-shared-files', 'everkeep-shared-files', false, 52428800) ON CONFLICT (id) DO NOTHING;
