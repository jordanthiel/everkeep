# Everkeep sharing on Supabase + Resend

Online sharing uses the existing Supabase project for Auth, Postgres, Edge Functions and private Storage. Resend remains the email provider, using a sender on your existing verified domain. No new email domain or Cloudflare sharing service is required. The browser portal is a static build that can be hosted under `/share/` on the existing website.

The local vault, sharing screens, selected-record permissions, collaboration, sync conflicts and file-saving flow are unchanged. No hosted vault data needs migrating from Cloudflare: that sharing service was never deployed. The unrelated legacy `workers/stripe-license` integration has not been changed.

## Connect the existing project

1. Choose the existing project's reference and run `supabase link --project-ref YOUR_PROJECT_REF`. There is deliberately no production project reference checked into this repository.
2. Review `supabase/migrations/20260921000000_sharing.sql`, then apply it with `supabase db push`. It creates the public `users`, `rate_limits`, `vaults`, `memberships`, `invitations`, and `audit` tables and a private `everkeep-shared-files` bucket. Supabase Auth tables remain in the separate `auth` schema. Row-level security is enabled, with no direct grants to browser `anon` or `authenticated` roles. The sharing API checks record-level authorization before decrypting content.
3. In Supabase Auth, enable email sign-in and configure **Custom SMTP using the existing Resend account**. Use the host/port and credentials shown in the Resend SMTP settings, and the existing verified sender. Set email OTP length to six digits and expiry to ten minutes. The passwordless sign-in template must display `{{ .Token }}`; the app uses codes, not magic-link redirects.
4. Set the following Edge Function secrets (see `.env.example`):
   - `SHARING_PUBLIC_URL`: the actual portal URL, including `/share` when hosted there.
   - `SHARING_FROM_EMAIL`: a sender on the existing verified Resend domain.
   - `RESEND_API_KEY`: the existing Resend key authorized for that sender.
   - `SHARING_DATA_KEY`: 32 random bytes encoded as base64. Preserve it securely; changing it without migration makes existing content unreadable.
   - `SHARING_AUTH_SECRET`: an independent random secret of at least 32 characters, used to fingerprint retries without retaining invitation passwords.
   - Optionally `SHARING_DATABASE_URL`: the project's transaction-mode pooler connection string. The runtime's `SUPABASE_DB_URL` is used otherwise. Prepared statements are disabled for pooler compatibility.

   For local development copy `.env.example` to `.env.local` and supply your own values. For hosted deployment use `supabase secrets set --env-file supabase/.env.local`. Never commit that file. The runtime supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; the server key never enters browser or desktop bundles.
5. Deploy with `supabase functions deploy sharing`. `verify_jwt=false` is intentional because sign-in is public. The handler validates Supabase Auth on every protected request and checks ownership/membership before returning or changing information. CORS allows only the configured portal origin.
6. Build the portal from the repository root:
   ```sh
   VITE_SHARING_API_URL=https://PROJECT_REF.supabase.co/functions/v1/sharing SHARING_PORTAL_BASE=/share/ npm run sharing:build
   ```
   Serve `sharing/dist` at `/share/` on the existing website host. Alternatively use an existing subdomain and omit `SHARING_PORTAL_BASE`. Invitations use `SHARING_PUBLIC_URL`, not the API hostname. Allow connections to that Supabase project in the website CSP and avoid third-party scripts in the authenticated portal.
7. Build the desktop app with:
   ```sh
   EVERKEEP_SHARING_URL=https://PROJECT_REF.supabase.co/functions/v1/sharing npm run build
   ```
   Use the same variable for the normal packaging command. The desktop learns the portal URL from `/api/config`. Unconfigured builds keep local saving and exports available.
8. Verify with accounts you control: email sign-in, invitations, browser/app opening, collaborator edits, source sync, session renewal and revocation. Automated tests never send real emails.

## Security and behavior

- Supabase Auth supplies verified account IDs. Vault subject/contact metadata never establishes ownership. Only the owner manages recipients; full viewing and editing remain separate grants.
- Records and attachments are AES-256-GCM encrypted before upload to private Supabase Storage. This is service-managed encryption, not end-to-end encryption. Postgres stores email, vault names, grants, revisions and audit metadata. No public Storage URLs bypass membership checks.
- Selected scope is a fixed set of record IDs; whole-vault access includes future records. Collaborator commits recheck active membership atomically with their revision comparison. Revocation blocks future API access, not copies already viewed or downloaded.
- Supabase Auth issues and validates codes, delivered through its Resend SMTP configuration. Resend's HTTP API sends reviewed invitations with idempotency keys. Invitation passwords are transient and never persisted in sharing tables, Storage or drafts.
- Desktop access/refresh tokens stay in the main process, encrypted with Electron safeStorage when available. Without a keychain, sign-in lasts for the app session. The browser stores only its Auth session in tab-scoped `sessionStorage`; no records, packets or file passwords are cached there. Closing the tab ends persisted sign-in. Rotated refresh tokens replace previous tokens. Network failures preserve the session; a rejected refresh requires sign-in again.
- Keep one original local file as the synchronization source. Recipients edit existing shared fields. Creating/archiving records and changing structured relationships remain in the native editor. An older file with unknown remote records stops syncing instead of overwriting hosted information.
- “Save an Everkeep file” produces an independent portable copy, with attachments and existing password protection. Online access controls apply to links, not copies of the file. Readable, unencrypted exports remain secondary.

## Validation and local development

- `npm run typecheck` and `npm run lint`
- `deno check --config supabase/functions/sharing/deno.json supabase/functions/sharing/index.ts`
- `npm test`: existing record/packet tests, authorization, Storage/Auth API contracts and session renewal/race handling.
- `npm run test:sharing:postgres`: starts an isolated Postgres 17 Docker container, applies the actual migration, and checks transactions, scopes, conflicts, revocation, RLS and private bucket metadata. It removes its container and never connects to a hosted project.
- `npm run test:sharing:supabase`: against the isolated local Supabase stack, checks real email OTP, Edge runtime, Storage, CORS, collaboration, token refresh, and direct-storage access denial. Serve the function with `SHARING_PUBLIC_URL=http://localhost:5173/share` and test-only encryption secrets. The test provisions a local membership directly and never calls Resend.
- `npm run test:sharing`: built Electron/browser flows with intercepted email and test-only Auth/Storage fixtures. Production always uses Supabase Auth/Storage and has no test-login bypass.

For the full local Supabase stack, run `supabase start`, apply local migrations with `supabase migration up --local`, then `npm run sharing:dev`. The runtime provides local Auth/Postgres/Storage; use its local email inbox for Auth codes. Point the portal to `http://127.0.0.1:56421/functions/v1/sharing`, and set `SHARING_PUBLIC_URL` to its actual origin/path. Invites still use the configured Resend key, so use only test recipients you control.

Plan recovery for Storage objects and the encryption key as well as Postgres. Replaced snapshots are removed; interrupted operations can leave inaccessible orphan objects. Cleanup must remove only unreferenced objects, not expire the entire bucket.
