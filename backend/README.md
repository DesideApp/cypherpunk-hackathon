# Deside Backend

Deside backend (v0.1 under construction).  
Architecture based on modular monolith with clear domain separation and adapters for API, WS, and workers.

---

## 🚀 Status
- **Version:** 0.1 (work in progress)
- **Node.js:** >= 20
- **Database:** MongoDB Atlas
- **Transport:** REST (Express) + Socket.IO (JWT RS256)

---

## 📂 Structure

```
src/
  apps/
    api/         # HTTP adapter (Express)
      v1/        # API version 1 (current v0.1)
    ws/          # (future) WebSocket adapter
    worker/      # (future) Workers / cron tasks
  modules/       # Domain modules
    auth/
    users/
    contacts/
    dm/
    relay/
    signal/
    rtc/
  shared/
    services/    # Common services
    utils/       # Utilities
  config/        # Central configuration
  jobs/          # Scheduled jobs
```

---

## 🔑 Authentication
- **JWT RS256** (private key stored in `/etc/secrets/jwtRS256.key` on Render).
- **Two flows:**
  - Cookies + CSRF (browser clients)
  - Bearer + `x-internal-api` (SDK / server-to-server)

---

## 🛡️ Security
- `protectRoute` → validates JWT (cookies or bearer).
- `adminProtect` → requiere `role: admin` o wallet incluida en `ADMIN_WALLETS` si habilitas rutas admin.

---

## 📡 API Endpoints (summary)

### Public
- `GET /api/health`
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/auth`

### Private (JWT cookie o Bearer)
- `GET /api/v1/contacts/*`
- `GET /api/v1/relay/*`
- `GET /api/v1/dm/*`
- `GET /api/v1/signal/*`
- `GET /api/v1/rtc/ice`

### RTC (Twilio)
- `GET /api/v1/rtc/ice` protegido por `protectRoute` y rate limit 10 req/min por usuario.
- Requiere env: `RTC_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, opcional `TWILIO_REGION`, `TURN_CRED_TTL`.

---

## 🔧 Development
```bash
npm install
npm run dev
```

`.env` example:
```
NODE_ENV=development
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=DesideCluster
JWT_ISSUER=deside-auth-v0.1
JWT_AUDIENCE=deside-app-v0.1
ALLOW_BEARER_AUTH=true
INTERNAL_API_SECRET=int-api-2025-08
BEARER_ROUTE_WHITELIST=^/api/(?:v1/)?(?:relay|signal|rtc)(?:/.*)?$
```

---

## 🧪 Testing in Render shell
```bash
export API="http://localhost:${PORT}"
export INTERNAL_API_SECRET='int-api-2025-08'

# Health
curl -sS "$API/api/health" | jq .

# Relay usage (private)
curl -sS -H "Authorization: Bearer $TOKEN" \
  -H "x-internal-api: $INTERNAL_API_SECRET" \
  "$API/api/v1/relay/usage" | jq .
```

---

## 📌 Next steps
- Document endpoints in `src/apps/api/v1/README.md`.
- Generate OpenAPI spec for v1.
- Move jobs to `/apps/worker`.
- Finalize **SIS (Solana Identity Standard)** endpoints.
