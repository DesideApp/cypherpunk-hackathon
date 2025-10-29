// src/jobs/jobStatusTracker.js
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.statusTracker' });

const JOB_STATUS = new Map();

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
  JOB_STATUS.set(name, {
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    meta,
  });
  log.debug('job_start', { job: name, meta });
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
}

export function getJobStatuses() {
  const out = {};
  for (const [name, status] of JOB_STATUS.entries()) {
    out[name] = serialize(status);
  }
  return out;
}

export default {
  recordJobStart,
  recordJobSuccess,
  recordJobError,
  getJobStatuses,
};
