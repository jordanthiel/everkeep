# AGENTS.md

## Cursor Cloud specific instructions

Everkeep is a **local-first Electron desktop app** (React + TypeScript + Vite via `electron-vite`) that stores data in embedded SQLite `.everkeep` vault files. There is **no backend server, network API, or external database** — the "backend" is the Electron main process talking to `better-sqlite3` in-process. A separate marketing website lives in `website/` (React + Vite, its own `npm install`).

Standard commands are in `README.md` and `package.json` scripts (`dev`, `build`, `typecheck`, `lint`, `test`; website: `website:dev`). Node 22 is expected (matches CI in `.github/workflows/release-windows.yml`). Only the notes below are non-obvious.

### Running the desktop app (GUI)
- Run with `npm run dev` (launches Electron + Vite HMR). It needs a display; a virtual X server is available at `DISPLAY=:1` in this environment, so the Electron window renders there and is visible to computer-use/screen tooling.
- In this container Electron prints benign, non-fatal warnings you can ignore: `Failed to connect to the bus` (D-Bus), `Exiting GPU process due to errors during initialization` (falls back to software rendering), and `dconf-WARNING`. The app still runs and renders normally.

### `better-sqlite3` native-module ABI gotcha (important)
- `better-sqlite3` is a native module that must be compiled against the **Electron** ABI to run the app, but against the **Node** ABI to run Vitest.
- `npm install` (via `postinstall` → `electron-builder install-app-deps`) leaves it built for **Electron**, so `npm run dev` works right after install.
- `npm test` rebuilds it for **Node** first and then rebuilds it back for **Electron** at the end. If a test run is interrupted before finishing, or you otherwise see a `NODE_MODULE_VERSION` / "was compiled against a different Node.js version" error when opening/creating a vault, run `npm run rebuild:electron` before `npm run dev`.

### First-run / vault flow (for end-to-end testing)
- On first launch the app shows a welcome screen: create a new vault or open an existing one. Creating a vault asks for user/household info and a password, then a save location (defaults under `~/Everkeep/<name>.everkeep`). After that you land on the Home dashboard with a sidebar (Home, People, Important Contacts, Identity, Legal & Estate, Financial, etc.).
- A test vault already exists at `~/Everkeep/My Family Vault.everkeep` (password `TestPass123!`) from environment setup; you can reuse it or create a fresh one.
