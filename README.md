# 🏆 DESIDE - Cypherpunk Hackathon Submission

> **End-to-end encrypted messaging with Solana wallet authentication + Blockchain Actions**

---

## 🎯 FOR JUDGES: START HERE

**⚡ This `main` branch contains our competition submission.**

### ✨ Demo Features (What We're Submitting)

<table>
<tr>
<td width="50%">

**🔗 Solana Blinks Integration**
- Native dial.to blink support
- Jupiter v6 swap integration
- Transaction validation & execution

**💰 Buy Token Modal**
- ✅ **LIVE & FUNCTIONAL**
- Real swaps via Jupiter API
- Token metadata with visual indicators
- Slippage control + gas estimation

**💳 Fund Wallet Modal**
- Complete UX flow (mock for demo)
- Multiple fiat on-ramp providers
- Responsive design + dark/light theme

</td>
<td width="50%">

**🤖 AI Token Discovery Agent**
- Automatic token discovery from Jupiter
- Visual metadata extraction (colors, icons)
- Intelligent caching & validation
- Expandable token catalog

**🔍 Enhanced Features**
- Link preview system for blinks
- Token search with visual metadata
- Wallet balance widget
- Settings panel with preferences
- Dark/Light theme toggle

</td>
</tr>
</table>

### 🎬 Quick Start for Judges

```bash
npm install
npm run demo
```

Open `http://localhost:3000` - **No configuration needed!**

---

## 💡 About This Submission

End-to-end encrypted messaging with blockchain wallet authentication. Combined repository with Express + Socket.IO backend and React (Vite) frontend.

## Structure

```
backend/   # REST API + WebSocket server  
frontend/  # React SPA (Vite)
```

## Getting Started

### 🚀 Quick Demo (Recommended for Evaluation)
```bash
npm install
npm run demo
```
Open `http://localhost:3000` - No external services needed, demo data pre-loaded.

### 🔧 Full Development
```bash
cp .env.example .env    # Fill in your API keys
npm install
npm run dev
```

## Scripts

- `npm run demo`: self-contained mode with in-memory database and mock services
- `npm run dev`: full development mode with external services
- `npm run lint`: ESLint on frontend
- `npm run test`: run test suites

## Messaging Actions

The chat UI ships with wallet-aware quick actions and natural command detection. Every action resolves to a Blink URL so the recipient can open the flow in their wallet.

| Action | How to trigger | Flow | Backend role | Status |
| --- | --- | --- | --- | --- |
| `Send` | Action bar or typing “envía 5 SOL” | Inline transfer preview → wallet signs (fallback opens Dialect) | Validates and proxies Blink execution at `/api/v1/blinks/execute` | ✅ production-ready |
| `Request` | Action bar or typing “pídeme 10 USDC” | Shares Dialect payment request to peer | Generates same Blink server-side for parity | ✅ production-ready |
| `Buy` | Action bar (“Buy”) | Jupiter quote + swap via `/api/v1/blinks/buy` | Fetches quote/swap, enforces token allow list | ✅ production-ready |
| `Fund` | Action bar (“Fund”) | Demo on-ramp walkthrough | — | 🧪 demo UI only |
| `Agreement` | Action bar (“Agreement”) | On-chain agreement draft between peers | Persists / signs via `/api/v1/agreements` | ⚠️ under repair |

Typing intent (send/request/buy/swap) is available in both the client and the API. Parser metadata is being consolidated so future actions stay in sync across frontend and backend.

## Technical Details

**Demo Mode:** Uses in-memory MongoDB, mock WebRTC services, pre-seeded data  
**Dev Mode:** Requires `.env` with real API keys (MongoDB, Twilio, etc.)  
**Ports:** Backend on `:3001`, Frontend on `:3000`

**Solana RPC:** Defaults to mainnet (`https://api.mainnet-beta.solana.com`). Override with `SOLANA_RPC_URL` (backend) and `VITE_SOLANA_RPC` (frontend) if you need a dedicated endpoint.

### User Profiles Data Source

- Single source of truth for user nickname/avatar/social across the app.
- Directory service caches profiles with TTL, dedupes in-flight fetches, and supports batch enrichment to avoid N+1.
- Hook `useUserProfile(pubkey)` provides `{ profile, loading, error, refetch }` and live updates.
- After editing your profile, the directory is primed so all views refresh instantly.

Docs:
- Frontend directory + hook: `docs/frontend/user-directory.md`
- Backend users API (GET, PUT, batch): `docs/backend/users-api.md`

### 🔐 E2EE Grade-1 Configuration

The app requires a shared static key for the current encryption tier. Define it in your frontend env (or root `.env`) before running:

```bash
VITE_E2E_SHARED_KEY_BASE64=$(openssl rand -base64 32)
```

If the variable is missing the UI shows the conversations but sending text or media returns `e2e-key-missing` and nothing leaves the browser. The same key must be present in every client instance taking part in the demo.

### Optional: Persistent Database

For persistent data between restarts:
```bash
mkdir -p docker-data/mongo
docker compose -f docker/docker-compose.yml up -d mongo
```
Set `DATA_MODE=local` and `MONGO_URI=mongodb://127.0.0.1:27017/deside` in `.env`.

---

## 🚀 Bonus: Post-Hackathon Roadmap

**Note:** The following features are in separate branches and demonstrate our long-term product vision. **They are NOT part of the hackathon submission** but show the complete ecosystem we're building.

### `feature/solana-blinks-actions` (Complete Production System)

<details>
<summary><b>📦 Expand to see production features</b></summary>

- **🤖 Telegram Bot Integration**
  - Natural language commands (`/buy`, `/send`, `/balance`)
  - Multi-chain wallet management
  - Fee system with automated distribution
  - Token catalog with real-time updates

- **📊 Admin Dashboard**
  - Real-time statistics & metrics
  - User management & monitoring
  - Traffic control & rate limiting
  - System health indicators

- **📈 Analytics Backend**
  - Message volume tracking
  - User growth metrics
  - Transaction analytics
  - MongoDB aggregation pipelines

- **🔔 Activity Feed System**
  - Real-time notifications
  - Event aggregation
  - Multi-channel delivery

</details>

### Architecture Notes

**Demo Mode:** Uses in-memory MongoDB, mock WebRTC services, pre-seeded data  
**Production Mode:** Full stack with persistent database, real API integrations

**Branches:**
- `main` → Competition submission (what you're reviewing now)
- `feature/demo-ready` → Same as main, staging for deployment
- `feature/solana-blinks-actions` → Complete production codebase

---

## 📚 Additional Documentation

- [Blink Registration Guide](docs/dial-to-blinks.md)
- [Fund Wallet Setup](docs/FUND_WALLET_SETUP.md)
- [Fund Wallet Providers](docs/FUND_WALLET_PROVIDERS.md)
- [AI Token Agent Demo](ai-token-agent/DEMO.md)

---

*Built with ❤️ for the Cypherpunk Hackathon | API routes and WebSocket interfaces remain compatible with the original architecture for seamless integration.*
