Metrics Architecture (Private)
==============================

Overview
--------
- Hot retention in MongoDB: 7 days for relay (TTL) and APM HTTP/WS (TTL).
- Hourly + daily snapshots (JSON.gz) written to `SNAPSHOT_DIR` (e.g. `/var/data/metrics`).
- Automatic archive fallback: if requested range starts before `HOT_RETENTION_DAYS`, the API reads snapshots and returns the same shapes as live overview.

Hot (Mongo)
-----------
- Relay TTL:
  - `RELAY_TTL_SECONDS=604800` (7d) and `RELAY_MESSAGE_TTL=604800`.
  - Apply: `npm run ttl:update`.
- APM TTL:
  - `APM_HTTP_TTL_DAYS=7`, `APM_WS_TTL_DAYS=7`.
  - Apply: `npm run apm:ttl:update`.
- Environment:
  - `HOT_RETENTION_DAYS=7` controls archive cutoff.
  - `SNAPSHOT_DIR=/var/data/metrics` (Render Disk), fallback to `./backups/metrics` in dev.

Snapshots
---------
- Hourly (overview): `backups/metrics/overview/YYYY/MM/DD/HH.json.gz`
  - { ts, range, messages { count, deliveryP95/50, ackP95/50, ackRate }, connections { count, unique, new, returning, returningRate }, rtc { successRate, ttcP95/50, fallback { ratioPct, count } } }
- Daily (overview-daily): `backups/metrics/overview-daily/YYYY/MM/DD.json.gz`
  - Aggregates the last 24 hourly files (sum counts, max unique, aggregate new/returning, average p95/50/ratios and returningRate).
- Cron schedules (backend/src/jobs/eventScheduler.js):
  - Hourly at :05 → `snapshotOverviewHourly()`
  - Daily at 00:10 → `snapshotOverviewDaily()`
  - Daily at 02:30 → `reconcileRelayHistory()` (repara drift relay↔history)

Archive Read Path
-----------------
- Controller: `backend/src/modules/stats/controllers/overview.controller.js`
  - If `rangeStart < now - HOT_RETENTION_DAYS`, use archive
  - ≤ 60 days: hourly; > 60 days: daily
- Service: `backend/src/modules/stats/services/archive.service.js`
  - Tries `.json.gz` first, then plain `.json` (compat)
  - Emits overview-shaped response with bucket { minutes: 60 | 1440 }

Admin Endpoints (Stats)
-----------------------
- Overview: `/api/v1/stats/overview` (with archive fallback)
- Infra: `/api/v1/stats/admin/infra/overview`
- Relay:
  - `/api/v1/stats/admin/relay/usage`
  - `/api/v1/stats/admin/relay/pending`
  - `/api/v1/stats/admin/relay/overview`
- Adoption:
  - `/api/v1/stats/admin/adoption/overview`
  - `/api/v1/stats/admin/adoption/cohorts`
  - `/api/v1/stats/admin/adoption/funnel`
- Users (admin):
  - `/api/v1/stats/admin/users`
  - `/api/v1/stats/admin/users/recent-logins`
  - `/api/v1/stats/admin/users/top`

Event Instrumentation
---------------------
- Messaging: `relay_message` (to, bytes, recipientOnline, forced), `relay_delivered` (latencyMs), `relay_acked` (latencyMs), `relay_error{code}`, `relay_purged_ttl`, `relay_purged_manual`.
- RTC (WS): `rtc_offer`, `rtc_established{ttcMs}`, `rtc_failed{reason}`, `rtc_fallback_to_relay`.
- DM: `dm_started`, (optional `dm_accepted` when available)
- Infra (HTTP): apm_http; WS traces: apm_ws.
- Jobs: logs `cron_*` + tracker (`recordJobStart/Success/Error`) expuestos vía `/api/v1/stats/admin/jobs/status`.
- Reconciliación: `relay_history_drift_total`, `relay_history_repaired_total`, `relay_history_drift_missing_relay` para auditar drift.

Panel Data
----------
- Dashboard: delivery/ack p95/50 + ackRate, RTC success/TTC/fallback, Relay snapshot (pending + purged).
- Traffic: adds quality metrics (delivery/ack + rtc) to highlights.
- Relay: pending, online/offline split, purges, errors.
- Jobs & alerts: estado de cron jobs + métricas de reconciliación.
- Infra: requests/errors/p95/p99/top routes, series.
- Adoption: Activation A/B (24h), funnel, weekly cohorts.
- Users: summary cards for unique/new/returning wallets (with returningRate), DAU/WAU/MAU + ratio, Activation A/B conversion & TTA, plus top senders/receivers, relay usage y logins recientes.
- Actions: highlights para tokens (24h/total), blinks (éxito/volumen/exec fallidos) y comandos naturales (éxito/fallo/rechazo 24h), con la telemetría de DM/relay relegada a un bloque auxiliar.

Render Setup (min)
------------------
- Attach Disk (e.g. 1 GB) at `/var/data` and set `SNAPSHOT_DIR=/var/data/metrics`.
- Set env:
  - `RELAY_TTL_SECONDS=604800`, `RELAY_MESSAGE_TTL=604800`
  - `APM_HTTP_TTL_DAYS=7`, `APM_WS_TTL_DAYS=7`
  - `HOT_RETENTION_DAYS=7`, `SNAPSHOT_DIR=/var/data/metrics`
- After deploy, apply TTLs: `npm run ttl:update && npm run apm:ttl:update`

Scaling & Accuracy Notes
------------------------
- Percentiles: live computed from events; archived p95/50 shown per hour/day (trend-friendly). Exact percentiles for 1–6 months require sketches (t‑digest).
- If traffic grows: reduce `APM_*_TTL_DAYS`, enable APM sampling, or move snapshots to S3.
- For >60 days charts, archive aggregates to daily to keep charts readable.
