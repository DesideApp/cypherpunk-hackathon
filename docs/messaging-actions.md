# Messaging Actions Architecture

This note tracks how the chat actions, Blink helpers, and typing intents fit together across the repo.

## Overview

- UI entry points live in `frontend/src/features/messaging/ui/ActionBar.jsx` and `frontend/src/features/messaging/ui/WritingPanel.jsx`.
- Conversation-side effects (sending text, payment requests, blinks, agreements) live in `frontend/src/features/messaging/hooks/useMessaging.js`.
- Blink builders and explorers sit in `frontend/src/features/messaging/actions/` with helpers such as `blinkUrlBuilder.js`, `actions-registry.js`, and `command-parser.js`.
- Backend Blink execution is proxied through `backend/src/modules/blinks/controllers/executeBlink.controller.js` and `backend/src/shared/services/dialectBlinkService.js`.
- Natural command parsing mirrors across `backend/src/modules/natural-commands/` and `frontend/src/utils/naturalCommandsParser.js`.
- Agreements persist through `backend/src/modules/agreements/controllers/agreements.controller.js` and are surfaced in chat via the messaging hook.

## Action Breakdown

| Action | Frontend entry | Backend surface | Notes |
| --- | --- | --- | --- |
| Send | `ChatWindow.jsx:520`, `blinkUrlBuilder.js:44` | `/api/v1/blinks/execute` (`executeBlink.controller.js:4`) | Inline send signs directly; shares blink message after success. |
| Request | `ChatWindow.jsx:584`, `blinkUrlBuilder.js:74` | Natural commands share same URL; message payload emitted from `useMessaging.js:312`. | Blink builder reused for client + backend parity. |
| Buy | `BuyTokenModal.jsx`, `buyBlinkService.js:3` | `/api/v1/blinks/buy` (`buyBlink.controller.js`) | Backend enforces token allow list and slippage; shares result via `sendBlinkAction`. |
| Fund | `FundWalletModal.jsx` | — | Demo-only flow; keep isolated until onboarding provider is ready. |
| Agreement | `useMessaging.js:520`, `AgreementModal.jsx` | `/api/v1/agreements/*` (`agreements.controller.js`) | Uses E2EE envelopes; double-check conv key before sending. |

## Typing Intent vs. Action Buttons

1. **Action buttons** dispatch `chat:action:open` events. `ChatWindow.jsx:412` listens and opens the send/request modal or agreement modal.
2. **Natural commands** rely on duplicated parsers:
   - Client preview: `frontend/src/utils/naturalCommandsParser.js`.
   - Backend validation: `backend/src/modules/natural-commands/parser.js`.
   - Messaging-specific detector: `frontend/src/features/messaging/actions/actions-registry.js`.
3. Planned consolidation: move definitions to a shared module (e.g., `/shared/natural-commands/`) and generate backend/frontend bundles. Until then, keep regex edits aligned across the three registries.

## Shared Helpers

- Blink builders (`blinkUrlBuilder.js`) validate wallets, amounts, and token lists on the client before generating Dialect URLs.
- Backend proxy `executeBlinkAction` applies host/path allow-listing and wraps Dialect API failures with `BlinkExecutionError`.
- Token allow list is sourced from `/api/v1/tokens/allowed` in both the buy modal and Telegram bot catalog; clearing caches before on-demand fetch keeps listings fresh.
- Solana RPC defaults to mainnet (`https://api.mainnet-beta.solana.com`). Set `SOLANA_RPC_URL` / `VITE_SOLANA_RPC` if you need to point to a custom gateway.

## Debug Tips

- Enable `VITE_DEBUG_BLINK_LOGS` to trace send/request modal events.
- `createDebugLogger("agreement")` is wired inside `useMessaging.js`; set `VITE_DEBUG_AGREEMENT_LOGS=1` to watch agreement payloads.
- Backend logs for natural commands live under the `natural-commands` namespace; check both parse and execute logs for discrepancies.

## Open Items

- Merge the parser registries into a single source of truth and regenerate consumers.
- Replace the fund modal demo with a real on-ramp integration once provider APIs are chosen.
- Re-enable agreements once the signer workflow (`prepare-sign`, `confirm`) is confirmed end-to-end in dev.
