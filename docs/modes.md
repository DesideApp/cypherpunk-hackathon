# Runtime Modes and Feature Flags

This repo powers two flavours of the app:

- **Development** – default, full backend + RTC + Mongo (memory or real).
- **Demo** – lightweight showcase, in-memory data, relay-only messaging.

The table below summarises the key toggles and their effects.

| Component | Flag / Variable | Dev default | Demo behaviour | Notes |
|-----------|-----------------|-------------|----------------|-------|
| Frontend | `VITE_DEMO_MODE` | `false` | `true` → storage namespace `deside_demo`, cookie suffix `_demo`, STUN list expanded, messaging policy defaults to relay-only | Set in `frontend/.env` or via Vite runtime. |
| Frontend | `VITE_USE_WEBRTC_FOR_TEXT` | `true` | `false` by default when `VITE_DEMO_MODE=true` | Controls whether the client even attempts RTC. |
| Frontend | `VITE_FORCE_RELAY` | `false` | `true` when `VITE_DEMO_MODE=true` | Overrides the transport selector. |
| Frontend | `VITE_E2E_SHARED_KEY_BASE64` | set to a demo key | Optional; if you migrate to session-handshake, leave it empty so the SDK negotiates dynamically. |
| Backend | `DEMO_MODE` | `false` | `true` → forces `DATA_MODE=memory`, seeds demo data, switches RTC provider to mocked “demo” | Implemented in `backend/src/config/demoMode.js`. |
| Backend | `DATA_MODE` | `memory` (via `.env`) | same | `memory` spins up `mongodb-memory-server`; set a real URI to hit an external cluster. |
| Backend | `ALLOW_BEARER_AUTH` | `false` | `false` (but can be overridden) | If you enable it, add proper regexes to `BEARER_ROUTE_WHITELIST`. |
| Backend | `RTC_SIGNAL_LEGACY_ENABLED` | `false` | often `true` when demoing wallets that still speak the legacy channel | Legacy `socket.emit('signal', …)` handler stays disabled in dev. |
| Backend | `FEATURE_FLAG_RTC_ICE` | `true` | `true` | Placeholder for future feature flag integration. |
| Backend | `ENABLE_RELAY` | `true` | `true` | Disable only if you want to test RTC without relay fallback (not recommended). |
| Shared | Cookies | `accessToken`, `refreshToken`, `csrfToken` | `accessToken_demo`, `refreshToken_demo`, `csrfToken_demo` | Names derive from `VITE_DEMO_MODE` + `COOKIE_SUFFIX`. |
| Shared | Storage namespace | `deside_dev` | `deside_demo` | Used for localStorage keys such as `csrfToken` and message cache. |

## Switching modes

1. **Frontend only demo** – set `VITE_DEMO_MODE=true` in `frontend/.env` and leave the backend untouched. You will still hit the real backend but the UI will behave like relay-only.
2. **Full demo** – set both `VITE_DEMO_MODE=true` and `DEMO_MODE=true`. The backend will seed mock contacts/chats and use in-memory Mongo + mock RTC credentials.
3. **Back to dev** – remove/disable both flags and ensure `.env` points to the intended Mongo instance (or keep `DATA_MODE=memory` if that’s good enough for you).

## Related files

- `frontend/src/shared/config/env.js` – resolves `IS_DEMO`, cookie names, storage namespaces and messaging policy.
- `frontend/src/shared/services/tokenService.js` – reads cookies/CSRF, shared between browser and Socket.IO auth.
- `backend/src/config/demoMode.js` – applies demo defaults for the server.
- `backend/src/middleware/authMiddleware.js` – cookie vs bearer auth logic.
- `backend/src/shared/services/websocketServer.js` – STUN/TURN provisioning, presence, and RTC signalling.

Keep this document updated whenever you introduce a new flag or change defaults so everyone knows how the modes differ.
