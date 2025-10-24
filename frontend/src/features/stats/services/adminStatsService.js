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

