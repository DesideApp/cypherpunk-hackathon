# Deside Hackathon - Encrypted Messaging Platform

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

## Technical Details

**Demo Mode:** Uses in-memory MongoDB, mock WebRTC services, pre-seeded data  
**Dev Mode:** Requires `.env` with real API keys (MongoDB, Twilio, etc.)  
**Ports:** Backend on `:3001`, Frontend on `:3000`

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

*API routes and WebSocket interfaces remain compatible with the original architecture for seamless integration.*
