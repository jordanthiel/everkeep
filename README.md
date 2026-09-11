# Everkeep

A modern local-first desktop application for organizing the information your family would need if you couldn’t be there to explain it.

Everkeep is **not** a will-creation tool and does not provide legal, tax, or financial advice.

## Stack

- Electron
- React + TypeScript
- Vite (`electron-vite`)
- SQLite (`.everkeep` vault files)
- TanStack Query + Zustand
- Tailwind CSS

## Development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Package

```bash
npm run dist:mac
# Prefer building the Windows installer on Windows (or GitHub Actions):
npm run dist:win
```

Windows installers built on Apple Silicon can look fine but fail after install with
“can’t find Everkeep.exe” because only the uninstaller was packaged. Use a
Windows machine or the `Release Windows` GitHub Action, then confirm
`release/win-unpacked/Everkeep.exe` exists before uploading the `.exe`.

## App updates

Installed copies check [GitHub Releases](https://github.com/jordanthiel/everkeep/releases/latest)
a few seconds after launch, and again once a day. If a newer version is published,
Everkeep shows a banner and a Settings → App updates section. The vault file is
not replaced.

Publishing a release must include electron-builder’s updater files:

- Windows: `latest.yml` plus the NSIS installer (the `Release Windows` workflow uploads these)
- macOS: `latest-mac.yml` plus the `.zip` (the `.dmg` is for first-time installs)

Bump `version` in `package.json` before tagging `v*`.

## Marketing site

The product landing page lives in [`website/`](./website) (React + Vite).

```bash
npm run website:dev
# or
cd website && npm install && npm run dev
```

Configure download URLs with `website/.env` (see `website/.env.example`).

## Pricing & licensing

Everkeep is **$79 one-time per household** (no subscription). The free trial
covers everything except exporting HTML reports; export requires a license.

- **Website pricing section:** `website/src/components/PricingSection.tsx`, driven by
  `website/src/config/pricing.ts`. Set `VITE_STRIPE_PAYMENT_LINK` in `website/.env`
  to your Stripe Payment Link (test or live). With no link configured, the buy
  button shows "opening soon" instead.
- **License keys** are Ed25519-signed and verified fully offline in the app
  (`src/main/license.ts`, `src/main/services/LicenseService.ts`). Keys look like
  `EK1.<payload>.<signature>` and are stored per machine in Electron `userData`.
- **Minting keys:** run `node scripts/mint-license.mjs --init` once to create a
  signing keypair (private key goes to `~/.everkeep-licensing/`, never committed),
  paste the printed public key into `EVERKEEP_LICENSE_PUBLIC_KEY_B64` in
  `src/main/license.ts`, then `node scripts/mint-license.mjs --email <customer>`
  to mint a key after each Stripe payment. Keys are activated in-app under
  Settings → License.
- **In-app purchase link:** `PURCHASE_URL` in `src/shared/constants/index.ts`
  (update once the marketing site is deployed).

## Architecture

```text
React Renderer
  → Typed Preload API (contextBridge)
  → IPC (Zod-validated)
  → Electron Main
  → VaultService / Repositories
  → SQLite .everkeep vault
```

Sensitive vault contents are never transmitted to a backend. Password encryption lands in Step 4.
