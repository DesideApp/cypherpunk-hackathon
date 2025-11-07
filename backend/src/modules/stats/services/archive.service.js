import fs from 'fs/promises';
import path from 'path';
import { gunzip as _gunzip } from 'zlib';
import { promisify } from 'util';

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
    connections: { totalInteractions: 0, uniqueParticipants: 0, newParticipants: 0, returningParticipants: 0, returningRate: null, history: [] },
    rtc: {}
  };
  let uniqueEstimate = 0;
  let newTotal = 0;
  let returningTotal = 0;
  const returningRates = [];
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const fileGz = path.join(baseDir, 'overview', yyyy, mm, dd, `${hh}.json.gz`);
    const fileJson = path.join(baseDir, 'overview', yyyy, mm, dd, `${hh}.json`);
    try {
      let snap;
      try {
        const gunzip = promisify(_gunzip);
        const gz = await fs.readFile(fileGz);
        const raw = await gunzip(gz);
        snap = JSON.parse(raw.toString('utf8'));
      } catch {
        const raw = await fs.readFile(fileJson, 'utf8');
        snap = JSON.parse(raw);
      }
      const label = d.toISOString();
      const msgCount = Number(snap?.messages?.count || 0);
      const connCount = Number(snap?.connections?.count || 0);
      out.messages.history.push({ timestamp: label, label, minutesAgo: null, value: msgCount });
      out.connections.history.push({ timestamp: label, label, minutesAgo: null, value: connCount });
      out.messages.total += msgCount;
      out.connections.totalInteractions = (out.connections.totalInteractions || 0) + connCount;
      const uniqueVal = Number(snap?.connections?.unique || 0);
      if (uniqueVal > uniqueEstimate) uniqueEstimate = uniqueVal;
      newTotal += Number(snap?.connections?.new || 0);
      returningTotal += Number(snap?.connections?.returning || 0);
      if (snap?.connections?.returningRate != null) returningRates.push(Number(snap.connections.returningRate));
      out.rtc = snap?.rtc || out.rtc;
    } catch {}
  }
  out.connections.uniqueParticipants = uniqueEstimate;
  out.connections.newParticipants = newTotal;
  out.connections.returningParticipants = returningTotal;
  out.connections.returningRate = returningRates.length ? Number((returningRates.reduce((s, v) => s + v, 0) / returningRates.length).toFixed(2)) : null;
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
    connections: { totalInteractions: 0, uniqueParticipants: 0, newParticipants: 0, returningParticipants: 0, returningRate: null, history: [] },
    rtc: {}
  };
  let uniqueEstimate = 0;
  let newTotal = 0;
  let returningTotal = 0;
  const returningRates = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const fileGz = path.join(baseDir, 'overview-daily', yyyy, mm, `${dd}.json.gz`);
    const fileJson = path.join(baseDir, 'overview-daily', yyyy, mm, `${dd}.json`);
    try {
      let snap;
      try {
        const gunzip = promisify(_gunzip);
        const gz = await fs.readFile(fileGz);
        const raw = await gunzip(gz);
        snap = JSON.parse(raw.toString('utf8'));
      } catch {
        const raw = await fs.readFile(fileJson, 'utf8');
        snap = JSON.parse(raw);
      }
      const label = d.toISOString();
      const msgCount = Number(snap?.messages?.count || 0);
      const connCount = Number(snap?.connections?.count || 0);
      out.messages.history.push({ timestamp: label, label, minutesAgo: null, value: msgCount });
      out.connections.history.push({ timestamp: label, label, minutesAgo: null, value: connCount });
      out.messages.total += msgCount;
      out.connections.totalInteractions = (out.connections.totalInteractions || 0) + connCount;
      const uniqueVal = Number(snap?.connections?.uniqueMax || snap?.connections?.unique || 0);
      if (uniqueVal > uniqueEstimate) uniqueEstimate = uniqueVal;
      newTotal += Number(snap?.connections?.new || 0);
      returningTotal += Number(snap?.connections?.returning || 0);
      const rate = snap?.connections?.returningRateAvg ?? snap?.connections?.returningRate;
      if (rate != null) returningRates.push(Number(rate));
      out.rtc = snap?.rtc || out.rtc;
    } catch {}
  }
  out.connections.uniqueParticipants = uniqueEstimate;
  out.connections.newParticipants = newTotal;
  out.connections.returningParticipants = returningTotal;
  out.connections.returningRate = returningRates.length ? Number((returningRates.reduce((s, v) => s + v, 0) / returningRates.length).toFixed(2)) : null;
  return out;
}

export async function readOverviewArchive(rangeStart, rangeEnd) {
  const diffMs = Math.abs(rangeEnd - rangeStart);
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (diffMs > sixtyDaysMs) return readOverviewArchiveDaily(rangeStart, rangeEnd);
  return readOverviewArchiveHourly(rangeStart, rangeEnd);
}
