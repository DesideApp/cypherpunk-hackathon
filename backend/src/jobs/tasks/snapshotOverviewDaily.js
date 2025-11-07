// Aggregate previous day's hourly overview snapshots into a daily snapshot
import fs from 'fs/promises';
import path from 'path';
import { gzip as _gzip, gunzip as _gunzip } from 'zlib';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { readSnapshot, saveSnapshot } from '#shared/services/snapshotStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function alignToDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }).catch(() => {}); }

export async function snapshotOverviewDaily() {
  const baseDir = process.env.SNAPSHOT_DIR || path.resolve(__dirname, '../../../..', 'backups', 'metrics');
  const now = new Date();
  // Previous day
  const dayEnd = alignToDay(now); // today 00:00 
  const dayStart = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000);

  const yyyy = String(dayStart.getFullYear());
  const mm = String(dayStart.getMonth() + 1).padStart(2, '0');
  const dd = String(dayStart.getDate()).padStart(2, '0');

  let msgTotal = 0;
  let connTotal = 0;
  let uniqueMax = 0;
  let newTotal = 0;
  let returningTotal = 0;
  const accum = {
    deliveryP95: [],
    ackP95: [],
    deliveryP50: [],
    ackP50: [],
    ackRate: [],
    rtcSuccess: [],
    rtcTtcP95: [],
    rtcTtcP50: [],
    rtcFallback: [],
    returningRate: [],
  };

  for (let h = 0; h < 24; h += 1) {
    const hh = String(h).padStart(2, '0');
    const relativKey = `overview/${yyyy}/${mm}/${dd}/${hh}.json.gz`;
    const gzFile = path.join(baseDir, 'overview', yyyy, mm, dd, `${hh}.json.gz`);
    const jsonFile = path.join(baseDir, 'overview', yyyy, mm, dd, `${hh}.json`);
    try {
      let raw;
      try {
        const gunzip = promisify(_gunzip);
        const gzBuffer = await readSnapshot({ key: relativKey, localPath: gzFile });
        if (!gzBuffer) throw new Error('not found');
        raw = (await gunzip(gzBuffer)).toString('utf8');
      } catch {
        const fileBuffer = await readSnapshot({ key: relativKey.replace(/\.gz$/, ''), localPath: jsonFile });
        if (!fileBuffer) throw new Error('snapshot not found');
        raw = fileBuffer.toString('utf8');
      }
      const snap = JSON.parse(raw);
      msgTotal += Number(snap?.messages?.count || 0);
      connTotal += Number(snap?.connections?.count || 0);
      uniqueMax = Math.max(uniqueMax, Number(snap?.connections?.unique || 0));
      newTotal += Number(snap?.connections?.new || 0);
      returningTotal += Number(snap?.connections?.returning || 0);
      const m = snap?.messages || {};
      const r = snap?.rtc || {};
      if (m.deliveryP95 != null) accum.deliveryP95.push(Number(m.deliveryP95));
      if (m.deliveryP50 != null) accum.deliveryP50.push(Number(m.deliveryP50));
      if (m.ackP95 != null) accum.ackP95.push(Number(m.ackP95));
      if (m.ackP50 != null) accum.ackP50.push(Number(m.ackP50));
      if (m.ackRate != null) accum.ackRate.push(Number(m.ackRate));
      if (r.successRate != null) accum.rtcSuccess.push(Number(r.successRate));
      if (r.ttcP95 != null) accum.rtcTtcP95.push(Number(r.ttcP95));
      if (r.ttcP50 != null) accum.rtcTtcP50.push(Number(r.ttcP50));
      if (r?.fallback?.ratioPct != null) accum.rtcFallback.push(Number(r.fallback.ratioPct));
      if (snap?.connections?.returningRate != null) accum.returningRate.push(Number(snap.connections.returningRate));
    } catch {}
  }

  const avg = (arr) => arr.length ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : null;

  const payload = {
    date: dayStart.toISOString().slice(0,10),
    messages: { count: msgTotal, deliveryP95Avg: avg(accum.deliveryP95), deliveryP50Avg: avg(accum.deliveryP50), ackP95Avg: avg(accum.ackP95), ackP50Avg: avg(accum.ackP50), ackRateAvg: avg(accum.ackRate) },
    connections: {
      count: connTotal,
      uniqueMax,
      new: newTotal,
      returning: returningTotal,
      returningRateAvg: avg(accum.returningRate),
    },
    rtc: { successRateAvg: avg(accum.rtcSuccess), ttcP95Avg: avg(accum.rtcTtcP95), ttcP50Avg: avg(accum.rtcTtcP50), fallbackAvg: avg(accum.rtcFallback) },
  };

  const outDir = path.join(baseDir, 'overview-daily', yyyy, mm);
  await ensureDir(outDir);
  const outFile = path.join(outDir, `${dd}.json.gz`);
  const gzip = promisify(_gzip);
  const buf = await gzip(Buffer.from(JSON.stringify(payload)));
  const key = `overview-daily/${yyyy}/${mm}/${dd}.json.gz`;
  const result = await saveSnapshot({ key, buffer: buf, localPath: outFile });
  return { file: result.location };
}
