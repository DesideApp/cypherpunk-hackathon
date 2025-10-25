# Backend: Users API (Profiles)

This document describes the user profile endpoints used by the frontend directory and profile flows.

Base Mounts

- Major version: `/api/v1` (alias `/api` may be enabled via `API_LEGACY_ALIAS=true`)
- Module: `/users`

Routes

1) GET `/api/users/:pubkey` (public)
- Validates `pubkey` against Base58 regex `^([1-9A-HJ-NP-Za-km-z]{32,44})$`.
- Returns:
  - `{ registered: false }` when not found
  - Or a normalized profile with relationship to requester if authenticated
- Shape:
  - `registered`: boolean
  - `pubkey`: string
  - `nickname`: string | null
  - `avatar`: string | null
  - `social`: `{ x?: string|null, website?: string|null }`
  - `relationship`: `'confirmed' | 'pending_out' | 'pending_in' | 'blocked' | 'none' | 'self'`
  - `blocked`: boolean
- Controller: `backend/src/modules/users/controllers/user.controller.js` → `findUserByPubkey`

2) POST `/api/v1/users/batch` (authenticated)
- Body: `{ pubkeys: string[] }` (cap: 200 pubkeys)
- Validates each pubkey with the same regex; deduplicates and trims input.
- Returns:
  - `results`: array of normalized profiles (same shape as above, with relationship/blocked when requester is authenticated)
  - `notRegistered`: string[] of pubkeys not found
- Controller: `backend/src/modules/users/controllers/user.controller.js` → `findUsersByPubkeys`
- Note: A public variant may be exposed under `/api/v1/users/public/batch`. In current config, the handler is protected; the frontend falls back to GET for unauthenticated usage.

3) PUT `/api/v1/users/me/profile` (authenticated)
- Body: `{ nickname?, avatar?, social? }`
  - `nickname`: 1–32 chars, trimmed; `null` or empty → clears field
  - `avatar`: http/https URL; `null` or empty → clears field
  - `social.x`: 1–32 chars, `A-Za-z0-9_`; leading `@` is stripped; `null` clears
  - `social.website`: http/https URL; `null` clears
- Returns updated values and a success message.
- Controller: `backend/src/modules/users/controllers/profile.controller.js` → `updateMyProfile`

4) POST `/api/v1/uploads/avatar` (authenticated)
- Body: `{ dataUrl: string }` where `dataUrl` is a base64 data URL for an image (webp/png/jpeg). Recommended size is a square 512x512 WebP.
- Limits: ~1.5MB binary (~2MB base64) max.
- Stores the file under the public folder and returns a path to serve the asset.
- Response: `{ url: "/uploads/avatars/<file>" }` (use frontend `apiUrl(url)` to convert to an absolute URL)
- Controller: `backend/src/modules/uploads/controllers/uploads.controller.js` → `uploadAvatar`

Notes and Guarantees

- Relationship: Computed against the requester when authenticated (Contact collection lookup once per batch via `$in`).
- Performance: Batch endpoint removes the N+1 pattern for contact enrichment; the frontend uses it whenever possible.
- Compatibility: Existing individual endpoint remains untouched; the frontend directory uses it for singles and as a fallback when unauthenticated.
- Error Handling: 400 for invalid/missing input, 500 for server errors with machine-friendly `error` + `nextStep` fields.

Examples

GET `/api/users/FooBase58...`

- 200 `{ "registered": false }`

- 200
```
{
  "registered": true,
  "pubkey": "FooBase58...",
  "nickname": "alice",
  "avatar": "https://.../avatar.png",
  "social": { "x": "alice", "website": "https://alice.xyz" },
  "relationship": "confirmed",
  "blocked": false
}
```

POST `/api/v1/users/batch`

Request
```
{ "pubkeys": ["FooBase58...", "BarBase58..."] }
```

Response
```
{
  "results": [
    { "registered": true,  "pubkey": "FooBase58...", ... },
    { "registered": false, "pubkey": "BarBase58..." }
  ],
  "notRegistered": ["BarBase58..."]
}
```
