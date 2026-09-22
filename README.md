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

`npm test` runs the unit tests, rebuilds SQLite for Electron, then checks encrypted vault saves, attachments, password changes, and backup restoration in a real Electron main process. Run `npm run test:electron` for that runtime check alone. It uses temporary test vaults and must not run with `ELECTRON_RUN_AS_NODE` enabled.

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

### Trusted macOS releases

macOS downloads must be signed with a **Developer ID Application** certificate
and notarized by Apple. An Apple Development certificate does not qualify for
distribution outside the App Store. This requires Apple Developer Program membership.

Configure these GitHub Actions repository secrets before running `Release macOS`:

- `MAC_CSC_LINK`: the base64-encoded `.p12` export of the Developer ID Application
  certificate **and its private key** from Keychain Access.
- `MAC_CSC_KEY_PASSWORD`: the password protecting that `.p12` export.
- `APPLE_ID`: the Apple account email used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for that account.
- `APPLE_TEAM_ID`: the developer team ID that owns the certificate.

Keep the certificate, private key, and passwords out of the repository. See
[Apple's Developer ID setup](https://developer.apple.com/developer-id/).

The `Release macOS` workflow runs on `v*` tags or manually and builds Apple Silicon
and Intel DMG/ZIP downloads, including `latest-mac.yml` for updates. It enables
the hardened runtime, signs the app, submits it to Apple, and staples the returned
notarization ticket. Signature, ticket, and Gatekeeper checks must pass before
the app is packaged and uploaded to GitHub Releases.

For local `npm run dist:mac`, provide the same Apple environment variables and
either install the Developer ID Application identity in your keychain or set
`CSC_LINK` and `CSC_KEY_PASSWORD` to the export and its password. Packaging fails
if signing or notarization is unavailable; use `npm run dev` for development.

Existing unsigned downloads are not repaired by this change. Bump the version,
build a signed/notarized release, and publish it with its updater files. Users
whose current copy cannot launch must download the new DMG.

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
