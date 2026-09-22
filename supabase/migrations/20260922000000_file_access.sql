CREATE TABLE file_packages (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL REFERENCES vaults(id), keys_payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX file_packages_vault ON file_packages(vault_id);
ALTER TABLE public.file_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.file_packages FROM anon, authenticated;
