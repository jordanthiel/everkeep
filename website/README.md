# Everkeep website

One static deployment serves the landing page at `/`, purchase confirmation at `/buy/success`, and shared-vault sign-in and invitation acceptance at `/share/`.

## Develop and deploy

Install dependencies in both the repository root and `website` (`npm ci` in each).
Run `npm run website:dev` from the root for local development.
Set `VITE_SHARING_API_URL=https://PROJECT_REF.supabase.co/functions/v1/sharing` in `website/.env.local` or the host build environment, then run `npm run website:build` from the root. Publish the entire `website/dist` directory as one deployment. `sharing:build` is a compatibility alias for this same build.

Serve `/share/` from `share/index.html` (including on reload), redirect `/share` to `/share/`, and rewrite `/buy/success` to the root `index.html`. Invitation links use `/share/#vault/VAULT_ID`; their hash survives sign-in. Set the Supabase `SHARING_PUBLIC_URL` secret to `https://YOUR_WEBSITE/share`. Supabase remains the API/Auth/Storage backend; there is no separate recipient website deployment.

The authenticated page has its own HTML entry, no marketing font requests, and a no-referrer policy. Allow connections to your Supabase endpoint in the host CSP; do not inject third-party analytics into `/share/`. Never put Resend keys or Supabase service secrets in `VITE_` variables.

Browser access supports hosted shared vaults and locally selected access-controlled `.everkeep` files. File contents stay on the device; email verification retrieves only permitted record keys. File edits require saving an updated file and do not synchronize. Creating local vaults and the complete guided editor remain in the desktop app.

## Download links

Set `VITE_DOWNLOAD_MAC`, `VITE_DOWNLOAD_WIN`, `VITE_RELEASES_URL`, and `VITE_APP_VERSION` in the website build environment.
