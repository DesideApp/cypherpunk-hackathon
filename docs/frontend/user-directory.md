# Frontend: User Directory and useUserProfile

This document describes the centralized user profile data source used across the app. It eliminates N+1 fetches, provides a single source of truth for nickname/avatar/social, and offers simple invalidation and live updates.

Overview

- Service file: `frontend/src/shared/services/userDirectory.js`
- Hook: `frontend/src/shared/hooks/useUserProfile.js`
- Downstream consumers: contacts updater, ChatHeader, profile editor, and any component that needs a user’s profile by pubkey.

Design Goals

- One source of truth for user profiles (nickname, avatar, social, relationship, blocked).
- Shared in-flight requests and cache with TTL to avoid duplicate network calls.
- Batch fetch support to remove N+1 when enriching large contact lists.
- Simple API for priming and invalidation so profile changes propagate instantly.

API

Service `userDirectory`

- `getUser(pubkey)`: returns cached profile or null if missing/expired.
- `fetchUser(pubkey, { force? })`: fetches from backend (GET `/api/users/:pubkey`), caches, dedupes concurrent calls.
- `fetchMany(pubkeys, { force? })`: batch fetch (POST `/api/v1/users/batch` when authenticated; otherwise falls back to individual fetches). Caches and dedupes. Returns an array of normalized profiles.
- `primeUser(pubkey, partialData)`: merges and stores profile data (e.g. after saving your own profile), then notifies listeners.
- `invalidateUser(pubkey)`: drops the cache entry and notifies listeners.
- `subscribe(pubkey, listener)`: subscribe to updates for a pubkey; returns unsubscribe function.
- `clearAll()`: clears cache and listeners (called on logout/session expiry).
- `setTTL(ms)`: override cache TTL. Default TTL is 2 minutes; configurable via `VITE_USER_DIR_TTL_MS`.

Hook `useUserProfile`

- `useUserProfile(pubkey, { ensure = true })` → `{ profile, loading, error, refetch }`
  - Subscribes to directory updates for `pubkey`.
  - If `ensure` is true and there’s no cached entry, triggers a fetch.
  - `refetch(force)` re-queries backend and refreshes cache.

Normalization

All profiles returned by the directory use this shape:

- `registered`: boolean
- `pubkey`: string | null
- `nickname`: string | null
- `avatar`: string | null
- `social`: `{ x: string | null, website: string | null }`
- `relationship`: `'confirmed' | 'pending_out' | 'pending_in' | 'blocked' | 'none' | 'self'`
- `blocked`: boolean

Integration Points

- Contacts enrichment: `frontend/src/features/contacts/services/contactsUpdater.js`
  - Collects unique pubkeys from confirmed/pending/incoming
  - Calls `userDirectory.fetchMany([...])`
  - Reads `nickname/avatar/blocked` from the directory, returning enriched lists
  - This primes the cache for other views (left panel, headers, etc.)

- Chat header: `frontend/src/features/messaging/ui/ChatHeader.jsx`
  - Uses `useUserProfile(pubkey)` to render avatar/nickname consistently

- Profile (current user): `frontend/src/features/profile/hooks/useProfile.js`
  - Wraps `useUserProfile(currentWallet)`
  - After `updateMyProfile`, calls `userDirectory.primeUser(wallet, updatedData)` then `refetch()`
  - Avatar upload: the profile UI can upload and optimize a local image and store it via `/api/v1/uploads/avatar`, then save the returned URL in the profile.

- Add contact: `frontend/src/features/contacts/hooks/useAddContactManager.js`
  - Uses `userDirectory.fetchUser(pubkey)` to validate existence/relationship before sending the request
  - After sending, forces `fetchUser(pubkey, { force: true })` to refresh relationship

Invalidation and Session

- After saving profile → `primeUser(yourPubkey, updated)`
- On logout/sessionExpired → `userDirectory.clearAll()` to avoid stale data
- In the future, a single event (e.g., WebSocket "contact_changed_avatar") can call `primeUser(pubkey, patch)` to update all views instantly

Backend Contracts

- `GET /api/users/:pubkey`  → individual profile (public)
- `POST /api/v1/users/batch` → batch profiles (authenticated); the directory falls back to individual if no session
- `PUT /api/v1/users/me/profile` → updates nickname/avatar/social; after success, prime the directory

Configuration

- `VITE_USER_DIR_TTL_MS`: optional override of cache TTL (ms). Default: `120000` ms

Edge Cases

- Invalid pubkey format → returns `{ registered: false }` without throwing
- Unregistered users → normalized to `registered:false`; downstream UI can show “unregistered” or minimal identity
- Mixed results in batch: `notRegistered` array is used to normalize cache entries (`registered:false`)

Migration Notes

- Legacy `searchUserByPubkey` has been removed. All new code should depend on `userDirectory` + `useUserProfile`.
- For components that only read data (no fetching needed), prefer `userDirectory.getUser(pubkey)` to avoid triggering network calls.
