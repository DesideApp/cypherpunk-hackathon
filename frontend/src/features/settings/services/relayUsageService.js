import { apiRequest } from '@shared/services/apiService.js';
import { ENDPOINTS } from '@shared/config/env.js';

export async function fetchRelayUsage() {
  const res = await apiRequest(ENDPOINTS.RELAY.USAGE, { method: 'GET' });
  if (!res || res.error) {
    const message = res?.message || 'Failed to load relay usage';
    throw new Error(message);
  }
  return res.data ?? res;
}

export async function purgeRelayMailbox({ target = 'relay', fraction = 1 } = {}) {
  const payload = {
    target,
    fraction,
  };
  const res = await apiRequest(ENDPOINTS.RELAY.PURGE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res || res.error) {
    const message = res?.message || 'Failed to purge relay mailbox';
    throw new Error(message);
  }
  return res.data ?? res;
}
