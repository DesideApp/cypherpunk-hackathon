# Development Setup

This project runs as a two-workspace monorepo (`frontend` + `backend`). The default development topology is:

- **Backend HTTP + Socket.IO** on `http://localhost:3001`
- **Frontend dev server (Vite)** on `http://localhost:3000`
- Both services loaded from the root scripts: `npm run dev` (Unix) / `npm run dev:parallel`

## 1. Environment files

- **Root `.env`** powers the backend and contains a mirror of the frontend variables for convenience. For local dev, the important bits are already set to use port `3001`.
- **`frontend/.env`** is the file that Vite actually reads. Keep the host values aligned with the backend (`VITE_API_BASE_URL=http://localhost:3001`, etc.).
- **`backend/.env`** is optional; the backend picks values from the root `.env`. Use it only if you need overrides that should not be shared with the frontend.

> Tip: when you change any `VITE_*` variable, restart the Vite dev server so the change propagates to the bundle.

## 2. Cookies, CSRF and auth flow

- The backend authenticates browsers through HTTP-only cookies (`accessToken`, `refreshToken`) plus a CSRF token. After logging in via REST, the frontend stores the CSRF in `localStorage` and forwards it on every request.
- Socket.IO handshakes reuse the same cookies and CSRF token. In dev we do **not** block the WebSocket if cookies are missing; the backend will reject unauthenticated handshakes.
- `ALLOW_BEARER_AUTH` is set to `false` locally, so only the cookie+CSRF path is enabled. If you flip it to `true`, remember to update `BEARER_ROUTE_WHITELIST` accordingly.

## 3. Messaging and WebRTC prerequisites

- RTC text transport is enabled by default via `VITE_USE_WEBRTC_FOR_TEXT=true` and `VITE_FORCE_RELAY=false`.
- The data channel timeout is short in dev (`VITE_RTC_OPEN_TIMEOUT_MS=2300`). Raise it temporarily if you need longer waits during debugging.
- Presence is considered stale after `45s` (`VITE_PRESENCE_TTL_MS`). Both peers must keep the WebSocket heartbeat running for RTC to stay available.

### Verifying RTC locally

1. Launch the backend (`npm run dev:backend`) and frontend (`npm run dev:frontend`) or use `npm run dev` to start both.
2. Sign in with two accounts in different browsers/profiles.
3. In the browser console, enable the transport logger (already handled by `frontend/.env`).
4. Send a message. A successful RTC path prints logs such as:
   - `[msg] sendText:success { via: 'rtc', ... }`
   - `[transport] sent-text { transport: 'rtc', ... }`
   - The receiving peer shows `[transport] incoming-rtc ...`
5. If the socket falls back to relay, check for reasons like `ws-closed`, `rtc-error-ineligible`, or presence being `false` in the debug output.

## 4. Demo mode vs dev mode (quick reference)

- **Dev mode** (default):
  - `VITE_DEMO_MODE` unset/false.
  - Storage namespace `deside_dev`, cookies without suffix.
  - Uses the real backend settings from `.env`.
  - WebRTC allowed.
- **Demo mode** (optional):
  - Set `VITE_DEMO_MODE=true` (frontend) and/or `DEMO_MODE=true` (backend).
  - Forces relay-only messaging, switches storage namespace, seeds demo data, and uses mock STUN/TURN.
  - Useful when you want a self-contained experience without external services.

See `docs/modes.md` for a full matrix of flags and effects.

## 5. Useful scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run backend and frontend concurrently (Unix shells). |
| `npm run dev:parallel` | Cross-platform equivalent using `npm-run-all`. |
| `npm run dev:backend` | Backend only (nodemon). |
| `npm run dev:frontend` | Frontend only (Vite). |
| `npm run test --workspace frontend` | Vitest suite for the SPA. |

## 6. Troubleshooting checklist

- **WebSocket never connects** → ensure backend is on `3001`, cookies are set after login, and there is no cross-domain mismatch (check `ALLOWED_ORIGINS`).
- **RTC always falls back** → confirm both peers are online (presence logs), the data channel opens (look for `dataChannelReady: true`), and that `USE_WEBRTC_FOR_TEXT` stays true.
- **Relay rejects payloads** → the backend enforces a 3 MB encrypted size cap (`RELAY_MAX_BOX_BYTES`). Adjust the env if you need higher limits for testing.

For deeper details (feature flags, demo behaviour, etc.), continue with `docs/modes.md`.
