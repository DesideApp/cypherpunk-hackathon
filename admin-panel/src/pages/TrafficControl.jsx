import { useState, useEffect, useMemo } from 'react';
import OverviewChart from '../components/OverviewChart';
import {
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatHistoryPoint,
  formatBucketDuration,
  formatRangeLabel
} from '../utils/periods';
import './TrafficControl.css';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const ADMIN_JWT =
  import.meta.env.VITE_ADMIN_JWT ||
  import.meta.env.VITE_API_TOKEN ||
  import.meta.env.VITE_BEARER_TOKEN ||
  '';

const resolveBaseUrl = () => {
  if (rawBaseUrl) {
    return rawBaseUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
};
const MOCK_USERS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  wallet: `User${i + 1}...`,
  requests: (Math.random() * 500 + 50).toFixed(0),
  bytes: (Math.random() * 100 + 10).toFixed(1),
  lastActivity: new Date(Date.now() - Math.random() * 3600000)
}));

const MOCK_ENDPOINTS = [
  { endpoint: '/api/messages', requests: 1250, avgTime: 45 },
  { endpoint: '/api/blinks', requests: 890, avgTime: 120 },
  { endpoint: '/api/auth', requests: 650, avgTime: 30 },
  { endpoint: '/api/users', requests: 420, avgTime: 25 },
  { endpoint: '/api/relay', requests: 380, avgTime: 80 }
];

const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const TRAFFIC_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((option) => option.key !== '1h');

export default function TrafficControl() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [periodMeta, setPeriodMeta] = useState(buildPeriodRequest('1d').meta);

  const fetchStats = async (silent = false) => {
    try {
      const { params, meta } = buildPeriodRequest(selectedPeriod);
      setPeriodMeta(meta);

      if (!silent) setLoading(true);

      const baseUrl = resolveBaseUrl();
      const url = baseUrl
        ? new URL('/api/v1/stats/overview', baseUrl)
        : new URL('/api/v1/stats/overview', window.location.origin);

      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          ...(ADMIN_JWT ? { Authorization: `Bearer ${ADMIN_JWT}` } : {})
        },
        credentials: ADMIN_JWT ? 'omit' : 'include'
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setOverview(data);
      setPeriodMeta((prev) => ({
        ...prev,
        rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prev.rangeLabel,
        bucketMinutes: data?.bucket?.minutes ?? prev.bucketMinutes
      }));
      setError(null);
    } catch (err) {
      console.error('Failed to load traffic stats', err);
      setError('Failed to load traffic stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(false);
    const interval = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const messages = overview?.messages ?? {
    total: 0,
    history: []
  };

  const connections = overview?.connections ?? {
    totalInteractions: 0,
    uniqueParticipants: 0,
    peak24h: 0,
    avgActive: 0,
    history: []
  };

  const bucketMinutes = overview?.bucket?.minutes ?? periodMeta.bucketMinutes;
  const bucketMode = periodMeta.bucketMode;

  const messageHistory = useMemo(() => {
    const meta = { bucketMinutes, bucketMode };
    return (messages.history ?? []).map((entry) => formatHistoryPoint(entry, meta));
  }, [messages.history, bucketMinutes, bucketMode]);

  const connectionHistory = useMemo(() => {
    const meta = { bucketMinutes, bucketMode };
    return (connections.history ?? []).map((entry) => formatHistoryPoint(entry, meta));
  }, [connections.history, bucketMinutes, bucketMode]);

  const chartData = messageHistory.map((entry, index) => ({
    label: entry.label,
    timestamp: entry.timestamp,
    messages: entry.value,
    connections: connectionHistory[index]?.value ?? 0
  }));

  const latestBuckets = messageHistory
    .map((entry, index) => ({
      timestamp: entry.timestamp,
      label: entry.label,
      messages: entry.value,
      connections: connectionHistory[index]?.value ?? 0
    }))
    .slice(-30)
    .reverse();

  const findExtremum = (series, comparator) =>
    series.reduce((acc, entry) => {
      if (!acc) return entry;
      return comparator(entry.value, acc.value) ? entry : acc;
    }, null);

  const pickPercentile = (series, percentile) => {
    if (!series.length) return null;
    const sorted = [...series].sort((a, b) => a.value - b.value);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
    );
    return sorted[index];
  };

  const peakMessageBucket = findExtremum(messageHistory, (candidate, best) => candidate > best);
  const peakConnectionBucket = findExtremum(connectionHistory, (candidate, best) => candidate > best);
  const p95MessageBucket = pickPercentile(messageHistory, 95);
  const p95ConnectionBucket = pickPercentile(connectionHistory, 95);

  const totalMessages = messages.total ?? 0;
  const totalInteractions = connections.totalInteractions ?? 0;

  const averageMessagesPerBucket = messageHistory.length
    ? Math.round(totalMessages / messageHistory.length)
    : 0;
  const averageConnectionsPerBucket = connectionHistory.length
    ? Math.round(connectionHistory.reduce((sum, entry) => sum + entry.value, 0) / connectionHistory.length)
    : 0;

  const loadRatio =
    averageMessagesPerBucket > 0 && peakMessageBucket
      ? (peakMessageBucket.value / averageMessagesPerBucket).toFixed(1)
      : null;

  const bucketLabel = formatBucketDuration(bucketMinutes);

  const topBusyBuckets = [...messageHistory]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((entry, index) => ({
      rank: index + 1,
      label: entry.label,
      messages: entry.value,
      connections:
        connectionHistory.find((item) => item.timestamp === entry.timestamp)?.value ?? 0
    }));

  const quietBuckets = [...messageHistory]
    .sort((a, b) => a.value - b.value)
    .slice(0, 5)
    .map((entry, index) => ({
      rank: index + 1,
      label: entry.label,
      messages: entry.value,
      connections:
        connectionHistory.find((item) => item.timestamp === entry.timestamp)?.value ?? 0
    }));

  const formatCount = (value) =>
    Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0';

  const chartMeta = { bucketMinutes, bucketMode };

  if (loading) {
    return (
      <div className="traffic-loading">
        <div className="loading-spinner"></div>
        <p>Loading traffic data…</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="traffic-loading">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="traffic-control">
      <div className="traffic-header">
        <div className="traffic-header-titles">
          <h2>Traffic Control</h2>
          <p>System traffic monitoring and analysis</p>
        </div>
        <div className="period-selector">
          {TRAFFIC_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`period-btn ${selectedPeriod === option.key ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="traffic-summary">
        <div className="summary-card">
          <span className="summary-label">Peak throughput</span>
          <span className="summary-value">
            {formatCount(peakMessageBucket?.value)}
          </span>
          <span className="summary-note">per {bucketLabel}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average throughput</span>
          <span className="summary-value">{formatCount(averageMessagesPerBucket)}</span>
          <span className="summary-note">per {bucketLabel}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Peak concurrency</span>
          <span className="summary-value">
            {formatCount(peakConnectionBucket?.value ?? connections.peak24h)}
          </span>
          <span className="summary-note">unique participants</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average concurrency</span>
          <span className="summary-value">{formatCount(averageConnectionsPerBucket)}</span>
          <span className="summary-note">per {bucketLabel}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">P95 throughput</span>
          <span className="summary-value">
            {formatCount(p95MessageBucket?.value ?? 0)}
          </span>
          <span className="summary-note">spikes per {bucketLabel}</span>
        </div>
      </div>

      <div className="traffic-totals">
        <div className="meta-card">
          <span className="meta-label">Total messages</span>
          <span className="meta-value">{totalMessages.toLocaleString('en-US')}</span>
        </div>
        <div className="meta-card">
          <span className="meta-label">Total interactions</span>
          <span className="meta-value">{totalInteractions.toLocaleString('en-US')}</span>
        </div>
        <div className="meta-card">
          <span className="meta-label">Unique participants</span>
          <span className="meta-value">
            {(connections.uniqueParticipants ?? 0).toLocaleString('en-US')}
          </span>
        </div>
        <div className="meta-card">
          <span className="meta-label">Range</span>
          <span className="meta-value">
            {periodMeta.rangeLabel || 'Selected range'}
          </span>
        </div>
        <div className="meta-card">
          <span className="meta-label">Bucket size</span>
          <span className="meta-value">{bucketLabel}</span>
        </div>
        <div className="meta-card">
          <span className="meta-label">Load ratio</span>
          <span className="meta-value">{loadRatio ? `×${loadRatio}` : '—'}</span>
        </div>
      </div>

      <div className="traffic-panels">
        <div className="panel-card panel-chart">
          <div className="panel-heading">
            <h3 className="panel-title">Load over time</h3>
            <span className="panel-subtitle">
              {periodMeta.rangeLabel || 'Selected range'}
            </span>
          </div>
          {(peakMessageBucket || p95MessageBucket || peakConnectionBucket) && (
            <div className="panel-insights">
              {peakMessageBucket && (
                <div className="insight-card">
                  <span className="insight-label">Peak throughput</span>
                  <span className="insight-value">{formatCount(peakMessageBucket.value)}</span>
                  <span className="insight-meta">per {bucketLabel}</span>
                </div>
              )}
              {p95MessageBucket && (
                <div className="insight-card">
                  <span className="insight-label">P95 throughput</span>
                  <span className="insight-value">{formatCount(p95MessageBucket.value)}</span>
                  <span className="insight-meta">per {bucketLabel}</span>
                </div>
              )}
              {peakConnectionBucket && (
                <div className="insight-card">
                  <span className="insight-label">Peak concurrency</span>
                  <span className="insight-value">{formatCount(peakConnectionBucket.value)}</span>
                  <span className="insight-meta">unique participants</span>
                </div>
              )}
              {p95ConnectionBucket && (
                <div className="insight-card">
                  <span className="insight-label">P95 concurrency</span>
                  <span className="insight-value">{formatCount(p95ConnectionBucket.value)}</span>
                  <span className="insight-meta">unique participants</span>
                </div>
              )}
              {loadRatio && (
                <div className="insight-card">
                  <span className="insight-label">Load ratio</span>
                  <span className="insight-value">×{loadRatio}</span>
                  <span className="insight-meta">peak vs avg throughput</span>
                </div>
              )}
            </div>
          )}
          <OverviewChart data={chartData} meta={chartMeta} />
        </div>

        <div className="panel-card panel-table">
          <div className="panel-heading">
            <h3 className="panel-title">Top load windows</h3>
            <span className="panel-subtitle">Highest throughput · {bucketLabel}</span>
          </div>
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Window</th>
                  <th>Messages</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {topBusyBuckets.map((row) => (
                  <tr key={`${row.rank}-${row.label}`}>
                    <td>{row.rank}</td>
                    <td>{row.label}</td>
                    <td>{row.messages.toLocaleString('en-US')}</td>
                    <td>{row.connections.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card panel-table">
          <div className="panel-heading">
            <h3 className="panel-title">Recovery windows</h3>
            <span className="panel-subtitle">Lowest load · {bucketLabel}</span>
          </div>
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Window</th>
                  <th>Messages</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {quietBuckets.map((row) => (
                  <tr key={`quiet-${row.rank}-${row.label}`}>
                    <td>{row.rank}</td>
                    <td>{row.label}</td>
                    <td>{row.messages.toLocaleString('en-US')}</td>
                    <td>{row.connections.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card panel-table">
          <div className="panel-heading">
            <h3 className="panel-title">Latest windows</h3>
            <span className="panel-subtitle">Last {latestBuckets.length} buckets</span>
          </div>
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Messages</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {latestBuckets.map((row) => (
                  <tr key={row.timestamp || row.label}>
                    <td>{row.label}</td>
                    <td>{row.messages.toLocaleString('en-US')}</td>
                    <td>{row.connections.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {messageHistory.length > latestBuckets.length && (
              <div className="overview-table-note">
                Showing latest {latestBuckets.length} buckets out of {messageHistory.length}.
              </div>
            )}
          </div>
        </div>

        <div className="panel-card mock-card">
          <div className="mock-card-header">
            <h3>Top Users by Traffic</h3>
            <span className="mock-badge">MOCK DATA</span>
          </div>
          <div className="users-list">
            {MOCK_USERS.map((user) => (
              <div key={user.id} className="user-item">
                <div className="user-info">
                  <span className="user-wallet">{user.wallet}</span>
                  <span className="user-activity">{formatTimeAgo(user.lastActivity)}</span>
                </div>
                <div className="user-stats">
                  <span className="user-requests">{user.requests} req</span>
                  <span className="user-bytes">{user.bytes} MB</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card mock-card">
          <div className="mock-card-header">
            <h3>Most Used Endpoints</h3>
            <span className="mock-badge">MOCK DATA</span>
          </div>
          <div className="endpoints-list">
            {MOCK_ENDPOINTS.map((endpoint) => (
              <div key={endpoint.endpoint} className="endpoint-item">
                <div className="endpoint-info">
                  <span className="endpoint-path">{endpoint.endpoint}</span>
                  <span className="endpoint-requests">
                    {endpoint.requests.toLocaleString('en-US')} requests
                  </span>
                </div>
                <div className="endpoint-performance">
                  <span className="endpoint-time">{endpoint.avgTime}ms avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
