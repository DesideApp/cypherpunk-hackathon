# 🚀 DESIDE - End-to-End Encrypted Messaging

> **Live at [deside.io](https://deside.io)** | End-to-end encrypted messaging with Solana wallet authentication + Blockchain Actions

---

## 🌐 Status

**✅ DESIDE is now live in production at [deside.io](https://deside.io)**

This repository contains the **hackathon submission** codebase that was developed for the Cypherpunk Hackathon. While we continue to develop and improve DESIDE privately, this public repository serves as a reference implementation and demonstration of the core features.

### 📝 Note for Developers & Judges

This repository is maintained as a **public reference** of our hackathon submission. Active development continues in **private repositories**.

**Important:** Some parts of the codebase have been simplified for the hackathon submission. Specifically:
- Advanced quota management and abuse detection logic
- Complex MongoDB aggregations for analytics
- Production-grade job schedulers and reconciliation tasks

**For Judges:** Full production implementations are available in our private repository (`deside-prod`). To request access for code review:

1. **Create an issue** in this public repository ([GitHub Issues](https://github.com/DesideApp/cypherpunk-hackathon/issues)) requesting access to the private repository
2. **Or contact us** through [deside.io](https://deside.io) - Use the contact form or reach out directly

We're happy to provide access to the private repository for evaluation purposes. Please include your GitHub username when requesting access.

---

## 🎯 What's Included

This repository demonstrates:

- **🔐 End-to-End Encrypted Messaging** - Secure peer-to-peer communication
- **🔗 Solana Wallet Authentication** - Web3-native user authentication
- **💰 Blockchain Actions** - Send, request, buy tokens directly from chat
- **🤖 AI Token Discovery** - Automatic token metadata extraction
- **📊 Admin Dashboard** - Real-time statistics and monitoring
- **🔔 Activity Feed** - Event aggregation and notifications

---

## 🏗️ Architecture

```
backend/   # Express + Socket.IO REST API + WebSocket server  
frontend/  # React SPA (Vite)
```

**Tech Stack:**
- Backend: Node.js, Express, MongoDB, Socket.IO
- Frontend: React, Vite, Solana Web3.js
- Infrastructure: Render (backend), Vercel (frontend), Cloudflare R2 (storage)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x
- MongoDB (or use demo mode with in-memory DB)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/DesideApp/cypherpunk-hackathon.git
cd cypherpunk-hackathon

# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Run in development mode
npm run dev
```

**Ports:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

---

## 📚 Documentation

- [Blink Registration Guide](docs/dial-to-blinks.md)
- [Price History Flow](docs/PRICE_HISTORY_FLOW.md)
- [Fund Wallet Setup](docs/FUND_WALLET_SETUP.md)
- [User Directory System](docs/frontend/user-directory.md)

---

## 🔒 Security Notes

- All `.env` files are gitignored - never commit secrets
- JWT keys should be generated per environment
- E2EE keys must be shared securely between clients
- See `.env.example` for required configuration

---

## 📄 License

This codebase was developed for the Cypherpunk Hackathon and is provided as-is for reference purposes.

---

## 🌟 Live Demo

**Visit [deside.io](https://deside.io) to see DESIDE in action!**

---

*Built with ❤️ for the Cypherpunk Hackathon | Active development continues privately*
