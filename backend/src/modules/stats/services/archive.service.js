import fs from 'fs/promises';
import path from 'path';

function alignToHour(d) { const x = new Date(d); x.setMinutes(0,0,0); return x; }
function alignToDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

async function readOverviewArchiveHourly(rangeStart, rangeEnd) {
  const baseDir = process.env.SNAPSHOT_DIR || path.resolve(process.cwd(), 'backups', 'metrics');
  const start = alignToHour(rangeStart);
  const end = alignToHour(rangeEnd);
  const out = {
    generatedAt: new Date().toISOString(),
    period: { key: 'archive-hourly', label: 'Archive (hourly)', start: start.toISOString(), end: end.toISOString(), minutes: Math.round((end-start)/60000) },
    bucket: { minutes: 60, count: Math.max(1, Math.ceil((end - start)/3600000)) },
    messages: { total: 0, history: [] },
    connections: { totalInteractions: 0, uniqueParticipants: 0, history: [] },
    rtc: {}
  };
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const file = path.join(baseDir, 'overview', yyyy, mm, dd, `${hh}.json`);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const snap = JSON.parse(raw);
      const label = d.toISOString();
      const msgCount = Number(snap?.messages?.count || 0);
      const connCount = Number(snap?.connections?.count || 0);
      out.messages.history.push({ timestamp: label, label, minutesAgo: null, value: msgCount });
      out.connections.history.push({ timestamp: label, label, minutesAgo: null, value: connCount });
      out.messages.total += msgCount;
      out.connections.totalInteractions = (out.connections.totalInteractions || 0) + connCount;
      out.rtc = snap?.rtc || out.rtc;
    } catch {}
  }
  return out;
}

async function readOverviewArchiveDaily(rangeStart, rangeEnd) {
  const baseDir = process.env.SNAPSHOT_DIR || path.resolve(process.cwd(), 'backups', 'metrics');
  const start = alignToDay(rangeStart);
  const end = alignToDay(rangeEnd);
  const out = {
    generatedAt: new Date().toISOString(),
    period: { key: 'archive-daily', label: 'Archive (daily)', start: start.toISOString(), end: end.toISOString(), minutes: Math.round((end-start)/60000) },
    bucket: { minutes: 1440, count: Math.max(1, Math.ceil((end - start)/86400000)) },
    messages: { total: 0, history: [] },
    connections: { totalInteractions: 0, uniqueParticipants: 0, history: [] },
    rtc: {}
  };
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const file = path.join(baseDir, 'overview-daily', yyyy, mm, `${dd}.json`);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const snap = JSON.parse(raw);
      const label = d.toISOString();
      const msgCount = Number(snap?.messages?.count || 0);
      const connCount = Number(snap?.connections?.count || 0);
      out.messages.history.push({ timestamp: label, label, minutesAgo: null, value: msgCount });
      out.connections.history.push({ timestamp: label, label, minutesAgo: null, value: connCount });
      out.messages.total += msgCount;
      out.connections.totalInteractions = (out.connections.totalInteractions || 0) + connCount;
      out.rtc = snap?.rtc || out.rtc;
    } catch {}
  }
  return out;
}

export async function readOverviewArchive(rangeStart, rangeEnd) {
  const diffMs = Math.abs(rangeEnd - rangeStart);
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (diffMs > sixtyDaysMs) return readOverviewArchiveDaily(rangeStart, rangeEnd);
  return readOverviewArchiveHourly(rangeStart, rangeEnd);
}

