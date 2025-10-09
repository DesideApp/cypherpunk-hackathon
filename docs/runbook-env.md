# Frontend env and Jupiter swap network switch

This project runs the app core (auth, WS/RTC, messaging) in devnet by default, and lets you test the Jupiter swap on devnet or mainnet without touching core settings.

## Baseline (.env)

Keep a single `frontend/.env` file as the source of truth for the app:

```
# Core app (devnet + local backend)
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_WEBSOCKET_URL=ws://localhost:3001/socket.io
VITE_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=...    # baseline devnet
VITE_SOLANA_CHAIN=devnet

# Jupiter swap (isolated, does not affect WS/RTC)
VITE_JUPITER_MODE=devnet  # devnet | mainnet
VITE_JUPITER_RPC_DEVNET=https://devnet.helius-rpc.com/?api-key=...
VITE_JUPITER_RPC_MAINNET=https://mainnet.helius-rpc.com/?api-key=...
```

Notes:
- Do not use `.env.local` unless you really need a private override; if present, it will override `.env` and can unintentionally break WS/RTC.
- The core app reads the core variables; the Jupiter plugin reads the `VITE_JUPITER_*` variables only.

## Switching the swap network

Change the swap network without touching WS/RTC:

1) Edit `frontend/.env` and set:
   - Mainnet: `VITE_JUPITER_MODE=mainnet`
   - Devnet: `VITE_JUPITER_MODE=devnet`
2) Restart the Vite dev server (`npm run dev`).

The rest of the app (WS/RTC) stays on devnet because it keeps using `VITE_WS_URL`, `VITE_WEBSOCKET_URL`, and `VITE_SOLANA_RPC`.

## Referral account (Jupiter)

- The Ultra plugin requires a valid referral account under the Ultra project. Use the address shown in the Ultra dashboard, and set a fee ≥ 50 bps.
- If the modal shows: “referralAccount is not initialized …”, switch to the Ultra tab in the referral dashboard, create the referral account and token accounts, then use that address in the integration.

## Quick verification

Core:
- Backend running at `http://localhost:3001`.
- Network tab: `ws://localhost:3001/socket.io` in status `open`.
- `GET /api/v1/auth/status` returns 200 after login (clear cookies if you see 401).

Swap:
- In devnet you may see “Error fetching route” (expected—no mainnet liquidity).
- In mainnet, routes (e.g., USDC→SOL) should resolve.

## Common issues and fixes

- WS closed / no presence:
  - Cause: backend down, cookies stale, or `.env.local` overriding WS.
  - Fix: start backend 3001, delete `.env.local`, clear cookies for `localhost:3000` and `localhost:3001`, restart Vite.

- “does not provide an export named 'FEATURES'” from `/src/shared/config/env.js`:
  - Cause: running build served an older module without `FEATURES` export.
  - Fix: ensure `env.js` exports `FEATURES` (it does in repo), restart Vite to clear the HMR cache.

- Swap modal opens and crashes (brand-only versions of plugin):
  - The integration already falls back to open without passthrough if a given plugin build rejects wallet props.

## Rationale

- One `.env` baseline keeps the app simple and predictable.
- The swap has its own variables (`VITE_JUPITER_*`) so changing its network never affects WS/RTC.
- Avoiding `.env.local` prevents accidental overrides that break presence/RTC.

