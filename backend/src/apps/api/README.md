# API Overview

This backend exposes the essentials for authentication, contacts, relay messaging, signal/RTC setup and health checks.

## Public endpoints
- `GET /api/health`
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/auth`

## Authenticated endpoints
- `GET /api/v1/contacts/*`
- `GET /api/v1/relay/*`
- `GET /api/v1/dm/*`
- `GET /api/v1/signal/*`
- `GET /api/v1/rtc/ice`

All private routes require `protectRoute` (JWT cookie or bearer with the internal secret).

## Relay usage
- `POST /api/v1/relay/enqueue`
- `GET /api/v1/relay/fetch`
- `POST /api/v1/relay/ack`
- `GET /api/v1/relay/usage`

## RTC
`GET /api/v1/rtc/ice` returns temporary TURN credentials (Twilio).

