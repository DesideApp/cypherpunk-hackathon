// Snapshot hourly overview metrics to local filesystem
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeStatsOverview } from '#modules/stats/services/metrics.service.js';
import { gzip as _gzip } from 'zlib';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function alignToHour(d) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

export async function snapshotOverviewHourly(opts = {}) {
  const baseDir = process.env.SNAPSHOT_DIR || path.resolve(__dirname, '../../../..', 'backups', 'metrics');
  const now = new Date();
  // Snapshot previous complete hour
  const rangeEnd = alignToHour(now);
  const rangeStart = new Date(rangeEnd.getTime() - 60 * 60 * 1000);

  const overview = await computeStatsOverview({ rangeStart, rangeEnd, bucketMinutes: 60 });

  const msgCount = (overview?.messages?.history || []).reduce((s, p) => s + (p.value || 0), 0);
  const connCount = (overview?.connections?.history || []).reduce((s, p) => s + (p.value || 0), 0);

  const payload = {
    ts: rangeEnd.toISOString(),
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    messages: {
      count: msgCount,
      deliveryP95: overview?.messages?.deliveryLatencyP95 ?? null,
      deliveryP50: overview?.messages?.deliveryLatencyP50 ?? null,
      ackP95: overview?.messages?.ackLatencyP95 ?? null,
      ackP50: overview?.messages?.ackLatencyP50 ?? null,
      ackRate: overview?.messages?.ackRate ?? null,
    },
    connections: { count: connCount, unique: overview?.connections?.uniqueParticipants ?? 0 },
    rtc: overview?.rtc ?? {},
  };

  const yyyy = String(rangeStart.getFullYear());
  const mm = String(rangeStart.getMonth() + 1).padStart(2, '0');
  const dd = String(rangeStart.getDate()).padStart(2, '0');
  const hh = String(rangeStart.getHours()).padStart(2, '0');
  const dir = path.join(baseDir, 'overview', yyyy, mm, dd);
  const file = path.join(dir, `${hh}.json.gz`);
  await ensureDir(dir);
  const gzip = promisify(_gzip);
  const buf = await gzip(Buffer.from(JSON.stringify(payload)));
  await fs.writeFile(file, buf);
  return { file };
}
