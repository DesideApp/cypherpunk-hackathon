import fetch from 'node-fetch';
import { env } from '#config/env.js';
import logger from '#config/logger.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const ALLOWED_HOST_SUFFIX = '.dial.to';

class BlinkExecutionError extends Error {
  constructor(message, { status, body, url }) {
    super(message);
    this.name = 'BlinkExecutionError';
    this.status = status ?? 500;
    this.body = body;
    this.url = url;
  }
}

function normalizeBaseUrl(raw) {
  const base = String(raw || '').trim();
  if (!base) return 'https://api.dial.to/v1';
  return base.replace(/\/+$/, '');
}

function assertAllowedActionUrl(actionUrl) {
  let parsed;
  try {
    parsed = new URL(actionUrl);
  } catch (error) {
    throw new BlinkExecutionError('Invalid actionUrl provided', {
      status: 400,
      body: { error: 'INVALID_ACTION_URL' },
      url: actionUrl,
    });
  }
  if (parsed.protocol !== 'https:') {
    throw new BlinkExecutionError('Action URL must be https', {
      status: 400,
      body: { error: 'INVALID_ACTION_URL_PROTOCOL' },
      url: actionUrl,
    });
  }
  if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    throw new BlinkExecutionError('Action URL host not allowed', {
      status: 400,
      body: { error: 'ACTION_URL_NOT_ALLOWED', host: parsed.hostname },
      url: actionUrl,
    });
  }
  if (!parsed.pathname.startsWith('/api/actions/')) {
    throw new BlinkExecutionError('Action URL path not allowed', {
      status: 400,
      body: { error: 'ACTION_URL_PATH_NOT_ALLOWED', path: parsed.pathname },
      url: actionUrl,
    });
  }
  return parsed.toString();
}

function buildBlinkExecuteUrl(actionUrl) {
  const base = normalizeBaseUrl(env.DIALECT_API_BASE_URL);
  return `${base}/blink?apiUrl=${encodeURIComponent(actionUrl)}`;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  try {
    return { body: JSON.parse(text), rawText: text };
  } catch (error) {
    return { body: null, rawText: text };
  }
}

export async function executeBlinkAction({ actionUrl, account, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!account || typeof account !== 'string') {
    throw new BlinkExecutionError('Account is required', {
      status: 400,
      body: { error: 'ACCOUNT_REQUIRED' },
      url: actionUrl,
    });
  }

  const normalizedActionUrl = assertAllowedActionUrl(actionUrl);
  const targetUrl = buildBlinkExecuteUrl(normalizedActionUrl);

  logger.info('▶️ [blink] executing action', {
    actionUrl: normalizedActionUrl,
    targetUrl,
    account,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (env.DIALECT_BLINK_CLIENT_KEY) {
    headers['X-Blink-Client-Key'] = env.DIALECT_BLINK_CLIENT_KEY;
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'transaction', account }),
      signal: controller.signal,
    });
  } catch (error) {
    logger.error('❌ [dialectBlinkService] fetch failed', {
      actionUrl: normalizedActionUrl,
      targetUrl,
      error: error?.message,
    });
    throw new BlinkExecutionError('Failed to contact blink provider', {
      status: 502,
      body: { error: 'BLINK_PROVIDER_UNREACHABLE' },
      url: targetUrl,
    });
  } finally {
    clearTimeout(timer);
  }

  const { body, rawText } = await parseJsonSafe(response);

  if (!response.ok) {
    logger.warn(
      `⚠️ [dialectBlinkService] provider error status=${response.status} raw=${rawText}`,
      {
        actionUrl: normalizedActionUrl,
        targetUrl,
        status: response.status,
        body,
        headers: Object.fromEntries(response.headers.entries()),
      }
    );
    throw new BlinkExecutionError('Blink execution failed', {
      status: response.status,
      body: body || { error: 'BLINK_EXEC_FAILED', raw: rawText },
      url: targetUrl,
    });
  }

  if (!body || typeof body !== 'object') {
    throw new BlinkExecutionError('Unexpected response from blink provider', {
      status: 502,
      body: { error: 'BLINK_INVALID_RESPONSE', raw: rawText },
      url: targetUrl,
    });
  }

  if (body.type === 'transaction' && typeof body.transaction === 'string') {
    logger.info('✅ [blink] transaction payload received', {
      actionUrl: normalizedActionUrl,
      targetUrl,
      type: body.type,
    });
    return {
      type: 'transaction',
      transaction: body.transaction,
      provider: 'dialect',
      reference: body?.dialectExperimental?.reference || null,
    };
  }

  if (body.type === 'transactions' && Array.isArray(body.transactions)) {
    logger.info('✅ [blink] multi-transaction payload received', {
      actionUrl: normalizedActionUrl,
      targetUrl,
      type: body.type,
      count: body.transactions.length,
      mode: body.mode || 'sequential',
    });
    return {
      type: 'transactions',
      transactions: body.transactions.filter((tx) => typeof tx === 'string'),
      mode: body.mode || 'sequential',
      provider: 'dialect',
      reference: body?.dialectExperimental?.reference || null,
    };
  }

  throw new BlinkExecutionError('Unsupported blink response payload', {
    status: 502,
    body,
    url: targetUrl,
  });
}

export { BlinkExecutionError };
