# Price History Flow - Technical Documentation

**Version:** 1.0  
**Last Updated:** 2025-10-29  
**Status:** ✅ Production Ready  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Components](#components)
5. [API Integration](#api-integration)
6. [Troubleshooting](#troubleshooting)
7. [Configuration](#configuration)

---

## Overview

The price history system displays 24-hour price charts for tokens in the Buy Token Modal. It uses a hybrid approach combining **CoinGecko API** for historical data and **Jupiter Price API v3** for real-time prices.

### Key Features

- ✅ 24-hour price history from CoinGecko
- ✅ Real-time prices from Jupiter
- ✅ Dual visualization (mini sparklines + hero chart)
- ✅ Color-coded trends (green/red)
- ✅ 60-second cache layer
- ✅ Graceful fallbacks

---

## Architecture

### Data Sources

| Data Type | Source | Endpoint | Update Frequency |
|-----------|--------|----------|------------------|
| **24h History** | CoinGecko | `/coins/{id}/market_chart` | Cached 60s |
| **Current Price** | Jupiter | `/price/v2` | Real-time |
| **24h Change %** | Jupiter | `/price/v2` | Real-time |

### Why Two APIs?

**CoinGecko:**
- ✅ Provides historical data (24h charts)
- ❌ Rate-limited in free tier (10-50 calls/min)
- ❌ Slightly delayed prices (5-10 min)

**Jupiter:**
- ✅ Real-time prices from Solana DEXs
- ✅ Higher rate limits
- ❌ No historical data

**Solution:** Use CoinGecko for charts, Jupiter for current price/change.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER OPENS MODAL                         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  BuyTokenModal.jsx      │
                    │  useEffect triggers     │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
       ┌────────▼──────┐  ┌─────▼─────┐  ┌──────▼──────┐
       │ fetchPrices() │  │ loadTokens │  │ fetchToken  │
       │ (Jupiter)     │  │ (Backend)  │  │ History     │
       └────────┬──────┘  └─────┬─────┘  │ (Backend)   │
                │                │        └──────┬──────┘
                │                │               │
       ┌────────▼──────────┐    │        ┌──────▼──────────┐
       │ Jupiter Price v3  │    │        │ GET /api/v1/    │
       │ /price/v2         │    │        │ tokens/:mint/   │
       │                   │    │        │ history         │
       └────────┬──────────┘    │        └──────┬──────────┘
                │                │               │
                │                │        ┌──────▼──────────┐
                │                │        │ Backend Cache   │
                │                │        │ (60s TTL)       │
                │                │        └──────┬──────────┘
                │                │               │
                │                │        ┌──────▼──────────┐
                │                │        │ CoinGecko API   │
                │                │        │ /coins/{id}/    │
                │                │        │ market_chart    │
                │                │        └──────┬──────────┘
                │                │               │
       ┌────────▼────────────────▼───────────────▼──────────┐
       │              FRONTEND STATE                        │
       │  - prices: { [mint]: { usdPrice, change24h } }   │
       │  - historyMap: { [mint]: { data[], source } }    │
       └────────────────────┬──────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
       ┌────────▼──────┐    │    ┌─────▼──────┐
       │ TokenButton   │    │    │ Sparkline  │
       │ (mini chart)  │    │    │ (hero)     │
       └───────────────┘    │    └────────────┘
                            │
                   ┌────────▼────────┐
                   │  USER SEES      │
                   │  - 8 mini       │
                   │    sparklines   │
                   │  - 1 hero chart │
                   │    (selected)   │
                   └─────────────────┘
```

---

## Components

### 1. Backend: Token History Endpoint

**File:** `backend/src/modules/tokens/routes/index.js`

```javascript
router.get('/:mint/history', async (req, res) => {
  const { mint } = req.params;
  const { points = 48, resolution = '1h' } = req.query;
  
  // 1. Lookup token metadata (code from mint)
  const tokenMeta = await getTokenByMint(mint);
  
  // 2. Check cache (60s TTL)
  const cacheKey = `${mint}:${points}:${resolution}`;
  const cached = priceHistoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < 60000) {
    return res.json({ success: true, data: cached.data, source: 'cache' });
  }
  
  // 3. Fetch from CoinGecko
  const history = await fetchCoingeckoHistory({ code: tokenMeta.code, days: 1 });
  
  // 4. Normalize to requested points
  const normalized = normalizePricePoints(history, points);
  
  // 5. Cache and return
  priceHistoryCache.set(cacheKey, { data: normalized, fetchedAt: Date.now() });
  res.json({ success: true, data: normalized, source: 'coingecko' });
});
```

**Key Functions:**

- `getTokenHistoryData()` - Main orchestrator
- `normalizePricePoints()` - Resamples data to fixed points (48)
- `fetchCoingeckoHistory()` - CoinGecko API wrapper

---

### 2. Backend: CoinGecko Service

**File:** `backend/src/shared/services/tokenHistoryService.js`

```javascript
const COINGECKO_IDS = {
  SOL: 'solana',
  BONK: 'bonk',
  JUP: 'jupiter-exchange-solana',
  JITOSOL: 'jito-staked-sol',
  POPCAT: 'popcat',
  USDC: 'usd-coin',
  USDT: 'tether',
  ORCA: 'orca',
};

export async function fetchCoingeckoHistory({ code, days = 1 }) {
  const id = COINGECKO_IDS[code.toUpperCase()];
  const url = `${COINGECKO_BASE_URL}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  
  const response = await fetch(url, { headers });
  const payload = await response.json();
  
  return payload.prices.map(([timestamp, price]) => ({
    timestamp: Number(timestamp),
    price: Number(price),
  }));
}
```

**Token Mapping:** CoinGecko uses specific IDs (not mint addresses). You must map `code → coingecko_id` manually.

---

### 3. Frontend: Price Service

**File:** `frontend/src/shared/services/priceService.js`

```javascript
export async function fetchTokenHistory(mint, walletAddress = null, points = 48, resolution = '1h') {
  const params = new URLSearchParams({ resolution, points: points.toString() });
  const url = apiUrl(`/api/v1/tokens/${encodeURIComponent(mint)}/history?${params}`);
  
  const res = await fetch(url, { credentials: 'include' });
  const result = await res.json();
  
  return {
    data: result.data,        // Array of 48 numbers
    points: result.points,
    source: result.source,    // 'cache' or 'coingecko'
  };
}
```

**Critical:** Always use `/api/v1/tokens/...` (not `/v1/tokens/...`) to match backend routing.

---

### 4. Frontend: BuyTokenModal

**File:** `frontend/src/features/messaging/ui/modals/BuyTokenModal.jsx`

#### State Management

```javascript
const [historyMap, setHistoryMap] = useState({});
// Structure: { [mint]: { data: number[], source: string } }

const [priceHistory, setPriceHistory] = useState([]);
// Current selected token's history (array of 48 numbers)
```

#### Data Loading (Selection Modal)

```javascript
useEffect(() => {
  if (!backendTokens?.tokens?.length) return;
  
  const entries = backendTokens.tokens.filter(t => t.mint);
  
  const results = await Promise.allSettled(
    entries.map(async (token) => {
      const res = await fetchTokenHistory(token.mint, null, 48, '1h');
      return { mint: token.mint, data: res.data, source: res.source };
    })
  );
  
  const nextHistory = {};
  results.forEach((result, idx) => {
    const mint = entries[idx].mint;
    if (result.status === 'fulfilled') {
      nextHistory[mint] = {
        data: result.value.data,
        source: result.value.source,
      };
    } else {
      nextHistory[mint] = { data: [], source: null };
    }
  });
  
  setHistoryMap(nextHistory);
}, [backendTokens]);
```

#### Tokens Enrichment

```javascript
const tokens = useMemo(() => {
  if (!backendTokens?.tokens) return [];
  
  return backendTokens.tokens.map((token) => {
    const enriched = enrichTokenWithMetadata(token);
    const entry = historyMap[token.mint] || null;
    return {
      ...enriched,
      history: entry?.data || [],           // Array of 48 numbers
      historySource: entry?.source || null,
    };
  });
}, [backendTokens, historyMap]);
```

#### Selected Token History (Execution Modal)

```javascript
useEffect(() => {
  if (!selected?.outputMint || !open) {
    setPriceHistory([]);
    return;
  }
  
  const entry = historyMap[selected.outputMint];
  if (entry?.data?.length) {
    setPriceHistory(entry.data);  // Array of 48 numbers
  } else {
    setPriceHistory([]);
  }
}, [selected, open, historyMap]);
```

---

### 5. Frontend: TokenButton (Mini Sparkline)

**File:** `frontend/src/features/messaging/ui/modals/TokenButton.jsx`

```javascript
const priceData = useMemo(() => {
  if (Array.isArray(token?.history) && token.history.length > 0) {
    return token.history;  // Array of 48 numbers
  }
  return [];
}, [token?.history]);

const sparklineTrend = useMemo(() => {
  if (priceData.length < 2) return 'neutral';
  const first = priceData[0];
  const last = priceData[priceData.length - 1];
  if (last > first) return 'positive';
  if (last < first) return 'negative';
  return 'neutral';
}, [priceData]);

return (
  <Sparkline
    data={priceData}
    variant="mini"
    width={56}
    height={20}
    trend={sparklineTrend}  // 'positive' | 'negative' | 'neutral'
  />
);
```

**Trend Calculation:** Compares first vs last data point. If equal → neutral.

---

### 6. Frontend: Sparkline Component

**File:** `frontend/src/shared/ui/charts/Sparkline.jsx`

```javascript
export function Sparkline({ data = [], variant = 'mini', trend = 'neutral', ... }) {
  const { path, gradientId } = useMemo(() => {
    if (!data || data.length < 2) return { path: '', gradientId: '' };
    
    // Normalize data to SVG viewBox
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => ({
      x: padding + (index / (data.length - 1)) * chartWidth,
      y: padding + chartHeight - ((value - min) / range) * chartHeight,
    }));
    
    // Build smooth Bézier curve path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    // ... curve logic
    
    return { path: pathD, gradientId };
  }, [data]);
  
  // Color selection based on trend
  const strokeColor = trend === 'positive' 
    ? 'var(--success-color)'   // #0FAF6F (green)
    : trend === 'negative'
    ? 'var(--danger-color)'    // #EA3943 (red)
    : 'var(--text-muted)';     // neutral gray
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`}>
      <path d={path} stroke={strokeColor} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
```

**Key:** Color is controlled by CSS variables:
- `--success-color` → Green (#0FAF6F)
- `--danger-color` → Red (#EA3943)
- `--text-muted` → Gray (neutral)

---

## API Integration

### CoinGecko API

**Endpoint:** `GET /coins/{id}/market_chart`

**Request:**
```bash
curl "https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1"
```

**Response:**
```json
{
  "prices": [
    [1761664625503, 200.10],
    [1761664966914, 199.81],
    ...
  ]
}
```

**Rate Limits:**
- Free tier: 10-50 calls/minute
- Demo tier: 500 calls/minute (with API key)

**Token ID Mapping:**
```javascript
SOL      → 'solana'
BONK     → 'bonk'
JUP      → 'jupiter-exchange-solana'
JITOSOL  → 'jito-staked-sol'
POPCAT   → 'popcat'
USDC     → 'usd-coin'
USDT     → 'tether'
ORCA     → 'orca'
```

---

### Jupiter Price API v3

**Endpoint:** `GET /price/v2`

**Request:**
```bash
curl "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112"
```

**Response:**
```json
{
  "So11111111111111111111111111111111111111112": {
    "price": 199.45,
    "priceChange24h": 2.3
  }
}
```

**Note:** Uses mint addresses directly (not codes).

---

## Troubleshooting

### Issue: No charts visible

**Symptoms:** Tokens load but no sparklines appear.

**Diagnosis:**
1. Open DevTools Console
2. Check for errors:
   ```
   [BuyTokenModal] Failed to load history for token
   error: 'history request failed (404)'
   ```

**Solution:** Verify API URL includes `/api`:
```javascript
// ❌ Wrong
apiUrl('/v1/tokens/:mint/history')

// ✅ Correct
apiUrl('/api/v1/tokens/:mint/history')
```

---

### Issue: Charts show but some are invisible

**Symptoms:** Some tokens (e.g., BONK, JUP) don't show charts.

**Diagnosis:**
```javascript
// In browser console:
Array.from(document.querySelectorAll('.buy-token')).map((btn, i) => {
  const path = btn.querySelector('svg path');
  const stroke = window.getComputedStyle(path).stroke;
  return `${i}: stroke=${stroke}`;
});

// If you see "stroke=none" → CSS variable missing
```

**Solution:** Define `--danger-color` in theme:
```javascript
// frontend/src/shared/utils/theme.js
"--danger-color": "#EA3943",  // Red for negative trends
```

---

### Issue: CoinGecko rate limit

**Symptoms:**
```
[tokens/history] Failed to fetch price history
error: 'Coingecko error 429: Rate limit exceeded'
```

**Solutions:**

1. **Increase cache TTL:**
```javascript
// backend/src/modules/tokens/routes/index.js
const PRICE_HISTORY_TTL_MS = 5 * 60 * 1000;  // 5 minutes instead of 60s
```

2. **Add CoinGecko API key:**
```bash
# backend/.env
COINGECKO_API_KEY=your_demo_key_here
```

3. **Implement fallback:** Use mock data when CoinGecko fails (see Configuration below).

---

### Issue: Charts not updating

**Symptoms:** Charts stay the same even after refreshing.

**Diagnosis:** Check cache status:
```javascript
// Browser console
fetch('/api/v1/tokens/So11111111111111111111111111111111111111112/history')
  .then(r => r.json())
  .then(d => console.log('Source:', d.source));
  
// If always 'cache' → backend cache not expiring
```

**Solution:** Clear backend cache or reduce TTL.

---

## Configuration

### Environment Variables

#### Backend

```bash
# .env or .env.production
COINGECKO_API_KEY=          # Optional, increases rate limit
COINGECKO_API_BASE_URL=     # Default: https://api.coingecko.com/api/v3
```

#### Frontend

```bash
# .env or .env.production
VITE_API_BASE_URL=https://your-backend.onrender.com  # Production backend URL
```

---

### Adding New Tokens

To add a new token with price history:

1. **Add to `tokens.json`:**
```json
{
  "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "code": "POPCAT",
  "label": "Popcat"
}
```

2. **Add CoinGecko mapping:**
```javascript
// backend/src/shared/services/tokenHistoryService.js
const COINGECKO_IDS = {
  ...
  POPCAT: 'popcat',  // Find ID from coingecko.com
};
```

3. **Verify mapping:**
```bash
curl "https://api.coingecko.com/api/v3/coins/popcat/market_chart?vs_currency=usd&days=1"
```

**How to find CoinGecko ID:**
1. Go to https://www.coingecko.com/
2. Search for your token
3. URL shows ID: `coingecko.com/en/coins/{ID}`

---

### Cache Configuration

**Current Settings:**
- TTL: 60 seconds
- Storage: In-memory Map
- Key format: `{mint}:{points}:{resolution}`

**Recommendations:**

**Development:**
```javascript
const PRICE_HISTORY_TTL_MS = 30 * 1000;  // 30s for faster testing
```

**Production:**
```javascript
const PRICE_HISTORY_TTL_MS = 5 * 60 * 1000;  // 5 minutes (reduces API calls)
```

**High Traffic:**
Consider Redis for shared cache across instances:
```javascript
// Future enhancement
const cached = await redis.get(`price:${cacheKey}`);
```

---

### Theme Colors

Price chart colors are controlled by CSS variables:

**File:** `frontend/src/shared/utils/theme.js`

```javascript
// Light mode
"--success-color": "#0FAF6F",  // Green (positive trend)
"--danger-color": "#EA3943",   // Red (negative trend)

// Dark mode
"--success-color": "#0FAF6F",  // Same green
"--danger-color": "#EA3943",   // Same red
```

**To customize:**
1. Change hex values in `theme.js`
2. Refresh browser (no rebuild needed, CSS variables are live)

---

## Performance Metrics

### Load Times (8 tokens)

| Step | Duration | Cached |
|------|----------|--------|
| Fetch token list | ~50ms | - |
| Fetch price history (parallel) | ~800ms | ~5ms |
| Parse & normalize | ~10ms | - |
| Render sparklines | ~30ms | - |
| **Total (first load)** | **~900ms** | - |
| **Total (cached)** | **~100ms** | ✅ |

### API Call Volume

**Scenario:** 100 users open Buy Modal simultaneously

**Without cache:**
- CoinGecko calls: 800 (100 users × 8 tokens)
- Result: ❌ Rate limit hit immediately

**With 60s cache:**
- CoinGecko calls: 8 (first user) + ~13/min (cache misses)
- Result: ✅ Under rate limit

**With 5min cache:**
- CoinGecko calls: 8 (first user) + ~3/min
- Result: ✅ Well under limit

---

## Testing

### Manual Testing Checklist

- [ ] Open Buy Modal → See 8 mini sparklines
- [ ] Click token → See hero chart
- [ ] Verify green charts (positive trend)
- [ ] Verify red charts (negative trend)
- [ ] Check browser console (no errors)
- [ ] Test with network throttling
- [ ] Test cache (open/close modal quickly)
- [ ] Test different tokens

### API Testing

```bash
# Test backend endpoint
curl http://localhost:3001/api/v1/tokens/allowed | jq '.tokens[0]'

# Test price history
curl "http://localhost:3001/api/v1/tokens/So11111111111111111111111111111111111111112/history?points=48" | jq '.data | length'

# Should return: 48

# Test CoinGecko directly
curl "https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1" | jq '.prices | length'

# Should return: ~290 (varies by time)
```

---

## Future Enhancements

### Planned Improvements

1. **Synthetic Data Mode** (for demos/videos)
   - Generate realistic price waves when APIs fail
   - Environment variable: `USE_SYNTHETIC_PRICE_HISTORY=true`
   - Status: 🚧 Design phase

2. **Redis Cache** (for production)
   - Shared cache across backend instances
   - Better TTL management
   - Status: 📋 Backlog

3. **Timeframe Selector**
   - 1h / 24h / 7d / 30d options
   - User preference saved
   - Status: 💡 Idea

4. **Price Tooltips**
   - Show exact price on hover
   - Display timestamp
   - Status: 💡 Idea

5. **Volume Overlay**
   - Trading volume bars
   - Requires additional API
   - Status: 💡 Idea

---

## Known Limitations

1. **CoinGecko Coverage**
   - Not all Solana tokens are listed
   - Must manually map `code → coingecko_id`
   - New tokens require code update

2. **Rate Limits**
   - Free tier: 10-50 calls/minute
   - Cache helps but not foolproof
   - Consider paid tier for production

3. **Data Freshness**
   - CoinGecko delays: ~5-10 minutes
   - Jupiter is real-time but no history
   - Small price mismatches expected

4. **No Granularity Control**
   - Always 24 hours
   - Always ~48 points (resampled)
   - User can't zoom in/out

---

## Deployment Checklist

### Pre-deployment

- [ ] Add `COINGECKO_API_KEY` to backend env (if available)
- [ ] Set `VITE_API_BASE_URL` in frontend env
- [ ] Test with production API endpoints
- [ ] Verify all token IDs in `COINGECKO_IDS`
- [ ] Check cache TTL is production-ready (5 min recommended)

### Post-deployment

- [ ] Monitor CoinGecko API usage
- [ ] Check error logs for rate limits
- [ ] Verify charts load in production
- [ ] Test from different regions
- [ ] Monitor response times

---

## Support

**Issues:** If charts don't load, check:
1. Browser console errors
2. Backend logs (`[tokens/history]` entries)
3. CoinGecko API status: https://status.coingecko.com/

**Common Fixes:**
- Clear browser cache: `Ctrl + Shift + R`
- Restart backend to clear cache
- Verify `.env` variables are loaded
- Check firewall/CORS settings

---

**Last Updated:** 2025-10-29  
**Maintainer:** DevOps Team  
**Related Docs:**
- [Buy Token Modal](./BUY_TOKEN_MODAL.md)
- [Sparkline Component](./SPARKLINE_COMPONENT.md)
- [Theme System](./THEME_SYSTEM.md)




