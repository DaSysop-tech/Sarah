# Sarah

Sarah is a small, self-contained task assistant used to demonstrate a working
full-stack development environment. It is an npm workspaces monorepo:

- `server/` — Express + TypeScript REST API (in-memory task store, no database).
- `web/` — Vite + React + TypeScript single-page app with a modern UI.

## Requirements

- Node.js >= 20 (developed on Node 22)
- npm >= 10

## Getting started

```bash
npm ci        # install all workspace dependencies
npm run dev   # start API (:3001) and web (:5173) together
```

Then open http://localhost:5173. The web dev server proxies `/api/*` to the API
on port 3001, so no extra configuration is needed.

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and web dev servers concurrently. |
| `npm run dev:api` | Run just the API (`http://localhost:3001`). |
| `npm run dev:web` | Run just the web app (`http://localhost:5173`). |
| `npm run build` | Type-check and build both the API and the web bundle. |
| `npm run typecheck` | Type-check both workspaces (also aliased as `npm run lint`). |
| `npm test` | Run the server test suite (Vitest). |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check. |
| `GET` | `/api/tasks` | List tasks (newest first). |
| `POST` | `/api/tasks` | Create a task `{ "title": "..." }`. |
| `PATCH` | `/api/tasks/:id` | Toggle completion `{ "done": true }`. |
| `DELETE` | `/api/tasks/:id` | Delete a task. |

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment:

- `install` runs `npm ci`.
- Two terminals start the API (`dev:api`) and web (`dev:web`) dev servers.
- Ports `5173` (web) and `3001` (api) are exposed.
