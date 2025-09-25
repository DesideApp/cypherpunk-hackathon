Purpose
-------
This README summarizes **what the SDK embedded bridges expose and how they integrate** with your front-end:
- `useWalletAuthBridge`: orchestrates **login by signature** (wallet ↔ backend).
- `useJupiterWalletBridge`: exposes a minimal **wallet interface for the Jupiter Plugin** (or any external integrable).

Both are designed to be **agnostic** (they do not depend on UI or your app tree) and to be extractable as an SDK.

High-level architecture
-----------------------
**Embedded SDK**
- `RpcProvider`: injects `endpoint`/`wsEndpoint` (network context).
- `WalletProvider`: normalizes adapters (Phantom, etc.), manages `connect/disconnect`, `publicKey`, `signMessage`, events.
- `AdapterManager` + `BaseWalletAdapter`: wallet detection and lifecycle.
- **Bridges** (this folder):
  - `useWalletAuthBridge`: coordinates `getNonce → signMessage → verifySignature` with the backend.
  - `useJupiterWalletBridge`: packages `publicKey`, `signMessage/Tx` for external integrations.

**Front**
- Use the SDK providers in the tree (or the SDK-wrapped providers).
- Call the bridge hooks from the views/services that need them (login, Jupiter via LeftBar, etc.).

Minimum contracts (interfaces)
------------------------------
**Adapter (what the bridge expects):**
```
connected: boolean
publicKey: string | null
signMessage(msg: string | Uint8Array): Promise<string | Uint8Array>
signTransaction?(tx: unknown): Promise<unknown>
signAllTransactions?(txs: unknown[]): Promise<unknown[]>
```
> Note: some adapters will sign and return **bytes**; others, **string**. The bridge normalizes that.

**useWalletAuthBridge(handlers)**:
```
type WalletAuthHandlers = {
  onConnected?(pubkey: string): void
  onDisconnected?(): void
  getNonce(pubkey: string): Promise<string>
  verifySignature(pubkey: string, signatureBase58: string): Promise<void>
  makeMessage?(pubkey: string, nonce: string): string
}
```
- `getNonce`: your API should return a nonce tied to the `pubkey`.
- `verifySignature`: your API validates the signature and issues a session (cookie/JWT).

**useJupiterWalletBridge() → JupiterWallet | null:**
```
type JupiterWallet = {
  publicKey: string
  signTransaction?(tx: unknown): Promise<unknown>
  signAllTransactions?(txs: unknown[]): Promise<unknown[]>
  signMessage?(msg: Uint8Array | string): Promise<string | Uint8Array>
}
```
- Use this for the plugin’s `enableWalletPassthrough` when you want **Jupiter to use your connected wallet**.

Login flow (useWalletAuthBridge)
--------------------------------
1) Detect connected wallet (`connected && publicKey`).  
2) Request `nonce` from backend.  
3) Build canonical message (you can customize `makeMessage`).  
4) Sign with the wallet (`signMessage`) and **normalize to Base58**.  
5) Send the signature to your API (`verifySignature`) to create a session.

Recommended message format to sign
----------------------------------
Include anti-clone and context fields:
```
Deside Login
origin=app.deside.io
pubkey=<base58>
nonce=<uuid>
ts=<ISO-8601>
```
Show the user what they will sign (if your UI allows). Do not include sensitive data.

Flow for Jupiter (useJupiterWalletBridge)
----------------------------------------
- If you use the **Web Plugin** (script): you can **not pass a wallet** and let the plugin connect on its own.  
- If you want to pass YOUR wallet (when the plugin version supports it), export the bridge result and pass it to the plugin API (e.g. `enableWalletPassthrough`, `passthroughWalletContextState`).

Plugin theming
--------------
- CSS variables are standardized in `:root` (light/dark) using `--jupiter-plugin-*` **in RGB**.  
- Theme changes apply instantly without touching the bridge (they are CSS-driven).  
- The **logo** is hot-swapped with `setBranding` or, if missing, with `close → init → resume` (already implemented in your LeftBar).

Robustness: why there are “more lines”
-------------------------------------
The bridges include defenses **needed in production** (you can disable some for a “lean” mode):
- **Signature normalization**: accepts `string | Uint8Array` and produces deterministic Base58.
- **Cancellation/race-safety**: prevents late responses from overwriting state after disconnect/account change/unmount.
- **Idempotency**: does not re-authenticate if the same `pubkey` is already authenticated.
- **Controlled errors**: try/catch with callbacks (`onError` optional if added) to avoid breaking the UX.
- **Stable dependencies**: uses `refs` and warns to avoid re-running for irrelevant changes.
- **UI-free**: no toasts inside the bridge; the front-end decides.

“Lean mode” (if you want fewer lines)
-------------------------------------
You can keep the bridges described and, if you need a compact version:
- Remove cancellation and idempotency (accept retries).
- Assume `signMessage` ALWAYS returns a Base58 `string` (⚠️ less compatible).
- Remove `onConnected/onDisconnected` if your UI does not use them.
> Still, **we recommend** the robust version for an external SDK.

Integration checklist
---------------------
1) In the app root tree:
   - `<RpcProvider endpoint="...">`
   - `<WalletProvider>`  
2) Login: use `useWalletAuthBridge({ getNonce, verifySignature, ... })` in an init effect or a gated screen.  
3) Jupiter:
   - Branding/theme: handled with CSS vars + hot-branding effect (LeftBar).
   - Wallet passthrough (if applicable): use `useJupiterWalletBridge()` and pass the returned object to the plugin init.
4) Backend security:
   - One-time-use nonce with short expiry.
   - Tie nonce to `pubkey` and the **origin**.
   - Invalidate sessions when `pubkey` changes.

Suggested testing
-----------------
- Adapter that returns **string** vs **Uint8Array** in `signMessage`.
- Rapid `publicKey` changes during login → should not leave inconsistent state.
- Unmounting component during login.
- Dark/light theme with modal **open** (logo swap should be OK).
- Network errors in `getNonce/verifySignature` → UI should not hang.

Extension: centralize defenses
-----------------------------
To reduce duplicated code in each bridge, create a shared helper (pseudocode):
```
withBridgeGuards(fn) => (deps...) => {
  let active = true
  try { return await fn({ active, toBase58, ... }) } finally {
    /* cleanup/cancel */
  }
}
```
Then wrap `useWalletAuthBridge` and future bridges with `withBridgeGuards`.

Packaging paths for SDK
-----------------------
- `wallet-adapter/core/contexts` → public providers.
- `wallet-adapter/core/bridges` → public hooks documented here.
- `wallet-adapter/adapters/*` → concrete adapters (internal/opt-in).
- Export a stable `index.ts` with docs and versioning.

Final notes
-----------
- Keep the adapter’s **minimal interface**. Do not expose wallet-specific internals to the front.
- Any UI (toasts, modals) must live outside the bridge.
- The current bridges are **production-ready** (core), with UI out of scope.
