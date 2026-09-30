CREATE TABLE owner_vault_keys (vault_id TEXT PRIMARY KEY REFERENCES vaults(id), key_payload TEXT NOT NULL);
ALTER TABLE public.owner_vault_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_vault_keys FROM anon, authenticated;
