// Fetch token prices via Jupiter Price API v3 (Lite)
// ids: array of mint addresses

export async function fetchPrices(ids = []) {
  try {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return {};
    const url = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(unique.join(','))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return data || {};
  } catch {
    return {};
  }
}

