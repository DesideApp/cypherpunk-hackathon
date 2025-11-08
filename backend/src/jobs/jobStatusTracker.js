// src/jobs/jobStatusTracker.js
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.statusTracker' });

const JOB_STATUS = new Map();
const JOB_HISTORY = new Map();

const MAX_HISTORY = Number.parseInt(process.env.JOB_HISTORY_LIMIT ?? '25', 10);

function pushHistory(name, payload) {
  const limit = Number.isFinite(MAX_HISTORY) && MAX_HISTORY > 0 ? MAX_HISTORY : 25;
  const queue = JOB_HISTORY.get(name) ?? [];
  queue.push(payload);
  while (queue.length > limit) {
    queue.shift();
  }
  JOB_HISTORY.set(name, queue);
}

function serialize(status) {
  if (!status) return null;
  const { startedAt, finishedAt, result, error, meta, status: st } = status;
  const durationMs =
    typeof startedAt === 'number' && typeof finishedAt === 'number'
      ? finishedAt - startedAt
      : null;
  return {
    status: st,
    startedAt,
    finishedAt,
    durationMs,
    meta: meta || null,
    result: result || null,
    error: error || null,
  };
}

export function recordJobStart(name, meta = {}) {
  const startedAt = Date.now();
  JOB_STATUS.set(name, {
    status: 'running',
    startedAt,
    finishedAt: null,
    result: null,
    error: null,
    meta,
  });
  log.debug('job_start', { job: name, meta });
  pushHistory(name, {
    event: 'start',
    status: 'running',
    at: startedAt,
    meta: meta || null,
  });
}

export function recordJobSuccess(name, result = {}) {
  const prev = JOB_STATUS.get(name) || {};
  const finishedAt = Date.now();
  JOB_STATUS.set(name, {
    status: 'success',
    startedAt: prev.startedAt ?? finishedAt,
    finishedAt,
    result,
    error: null,
    meta: prev.meta || null,
  });
  log.debug('job_success', { job: name, result });
  pushHistory(name, {
    event: 'success',
    status: 'success',
    at: finishedAt,
    startedAt: prev.startedAt ?? finishedAt,
    finishedAt,
    durationMs: typeof prev.startedAt === 'number' ? finishedAt - prev.startedAt : null,
    result: result || null,
  });
}

export function recordJobError(name, error) {
  const prev = JOB_STATUS.get(name) || {};
  const finishedAt = Date.now();
  const serializedError = error?.stack || error?.message || error || 'unknown';
  JOB_STATUS.set(name, {
    status: 'error',
    startedAt: prev.startedAt ?? finishedAt,
    finishedAt,
    result: null,
    error: serializedError,
    meta: prev.meta || null,
  });
  log.error('job_error', { job: name, error: serializedError });
  pushHistory(name, {
    event: 'error',
    status: 'error',
    at: finishedAt,
    startedAt: prev.startedAt ?? finishedAt,
    finishedAt,
    durationMs: typeof prev.startedAt === 'number' ? finishedAt - prev.startedAt : null,
    error: serializedError,
  });
}

export function getJobStatuses() {
  const out = {};
  for (const [name, status] of JOB_STATUS.entries()) {
    out[name] = serialize(status);
  }
  return out;
}

export function getJobHistory(limitPerJob = 10) {
  const limit = Number.isFinite(limitPerJob) && limitPerJob > 0 ? limitPerJob : 10;
  const snapshot = {};
  for (const [name, history] of JOB_HISTORY.entries()) {
    const sliced = history.slice(-limit).map((entry) => ({ ...entry }));
    snapshot[name] = sliced.reverse();
  }
  return snapshot;
}

export default {
  recordJobStart,
  recordJobSuccess,
  recordJobError,
  getJobStatuses,
  getJobHistory,
};
