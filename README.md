# Deside Hackathon Monorepo

Combined repository with the Express + Socket.IO backend and the React (Vite) frontend of the messenger. All hackathon work lives inside `deside-hackathon`.

## Structure

```
backend/   # REST API + WebSocket server
frontend/  # React SPA (Vite)
```

Each workspace keeps its own `package.json`, scripts, and configuration. The backend retains the original modular architecture (`src/apps`, `src/modules`, `src/shared`, etc.), and the frontend keeps the existing features (auth, wallets, messaging, contacts, layout, shared services…).

## Getting Started

1. Copy `.env.example` to `.env` at the repo root and fill in the secrets (JWT, Mongo, Twilio…).  
   - Copy every `VITE_*` line into `frontend/.env` (there is a template in `frontend/.env.example`).
2. Install dependencies from the root using workspaces:
   ```bash
   npm install
   ```
3. For demos without an external Mongo instance, keep `DATA_MODE=memory` (default). It uses an embedded Mongo via `mongodb-memory-server` that resets on every restart. The backend seeds demo data automatically (`SEED_DEMO=true`).
4. Start backend and frontend from the root:
   ```bash
   npm run dev:backend      # API/WS only (nodemon)
   npm run dev:frontend     # SPA only (vite)
   npm run dev:parallel     # both processes in parallel (concurrently)
   ```

## Useful Scripts

- `npm run dev` / `npm run dev:parallel`: start backend and frontend from the root.
- `npm run dev:backend` / `npm run dev:frontend`: individual processes.
- `npm run lint`: run ESLint on the frontend (React + hooks + TypeScript).
- `npm run test`: run Vitest (`frontend/src/shared/utils/base64.test.ts`, `tokenService.test.js`).
- `npm run build --workspace frontend`: build the SPA for production.
- Historical scripts remain available inside each package (`backend/npm run start`, `backend/npm run endpoints`, etc.).

## Run Modes

- `npm run dev`: full stack mode. Reads your `.env`, connects to the external Mongo cluster, uses Twilio TURN credentials, and leaves all realtime features enabled.
- `npm run demo`: self-contained demo mode. Forces in-memory Mongo (`mongodb-memory-server`), seeds the sample users/contacts, serves mock ICE servers, and enables frontend fallbacks (cached contacts, demo previews). No external secrets are required.

## Ports and Processes

- `npm run dev:backend` → API/WS on `http://localhost:3001` (embedded Mongo, Socket.IO, health check OK).
- `npm run dev:frontend` → Vite on `http://localhost:3000`.

Before starting, free any process already using those ports:

```bash
# list listening ports (refreshes every second, exit with Ctrl+C)
watch -n 1 "lsof -nP -iTCP -sTCP:LISTEN"

# or focus on a specific port
watch -n 1 "lsof -nP -i :3000"
```

If `npm run dev:frontend` attempts to use another port (e.g. 3001), there is an old Vite instance running. Kill it with:

```bash
lsof -i :3000          # identify the PID
kill <pid>
```

For demos, browse `http://localhost:3000` (not 127.0.0.1) and enable `withCredentials: true` in fetch/socket calls so the `accessToken` cookie is sent correctly. In memory mode the backend preloads demo users/contacts (disable with `SEED_DEMO=false`).

### Persistent Mongo (optional)

To keep users/contacts between restarts:

1. Create the data folder and start Mongo with Docker Compose:
   ```bash
   mkdir -p docker-data/mongo
   docker compose -f docker/docker-compose.yml up -d mongo
   ```
2. Update `.env`:
   ```
   DATA_MODE=local
   MONGO_URI=mongodb://127.0.0.1:27017/deside
   ```
3. Restart `npm run dev:backend`. Data will persist in `docker-data/mongo/`.

To reset the demo database:

```bash
docker compose -f docker/docker-compose.yml down
rm -rf docker-data/mongo/*
```

Then run the `docker compose up` command again.

## Notes

- API and socket routes stay identical to the original repository, so existing clients require no changes.
- `node_modules` directories and build artifacts are ignored via `.gitignore`.
- For future cleanups or extra modules, keep working in this monorepo so the history remains aligned with the hackathon project.
