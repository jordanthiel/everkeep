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
# or
npm run dist:win
```

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
