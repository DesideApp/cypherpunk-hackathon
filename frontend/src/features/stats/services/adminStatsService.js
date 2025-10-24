import { apiRequest } from "@shared/services/apiService.js";

/**
 * Fetch admin users list for the Users panel.
 * Supports pagination, sorting and search.
 */
export async function fetchAdminUsers({ page = 1, limit = 50, sortBy = 'lastLogin', sortOrder = 'desc', search = '' } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (sortBy) params.set('sortBy', String(sortBy));
  if (sortOrder) params.set('sortOrder', String(sortOrder));
  if (search) params.set('search', String(search));

  const url = `/api/v1/stats/admin/users?${params.toString()}`;
  const res = await apiRequest(url, { method: 'GET' });
  if (!res || res.error) {
    const message = res?.message || 'Failed to load admin users';
    throw new Error(message);
  }
  return res; // { data: [...], pagination: {...} }
}

export async function fetchTopUsers({ metric = 'sent', period = '1d', from, to, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (metric) params.set('metric', String(metric));
  if (from) params.set('from', typeof from === 'string' ? from : new Date(from).toISOString());
  if (to) params.set('to', typeof to === 'string' ? to : new Date(to).toISOString());
  if (!from && !to && period) params.set('period', String(period));
  if (limit) params.set('limit', String(limit));

  const url = `/api/v1/stats/admin/users/top?${params.toString()}`;
  const res = await apiRequest(url, { method: 'GET' });
  if (!res || res.error) throw new Error(res?.message || 'Failed to load top users');
  return res; // { data: [...], range, metric }
}

export async function fetchRelayUsage({ sortBy = 'ratio', sortOrder = 'desc', limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (sortBy) params.set('sortBy', String(sortBy));
  if (sortOrder) params.set('sortOrder', String(sortOrder));
  if (limit) params.set('limit', String(limit));

  const url = `/api/v1/stats/admin/relay/usage?${params.toString()}`;
  const res = await apiRequest(url, { method: 'GET' });
  if (!res || res.error) throw new Error(res?.message || 'Failed to load relay usage');
  return res; // { data: [...] }
}

export async function fetchRecentLogins({ limit = 20, search = '' } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (search) params.set('search', String(search));

  const url = `/api/v1/stats/admin/users/recent-logins?${params.toString()}`;
  const res = await apiRequest(url, { method: 'GET' });
  if (!res || res.error) throw new Error(res?.message || 'Failed to load recent logins');
  return res; // { data: [...] }
}
