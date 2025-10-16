import { useEffect, useRef, useState } from 'react';
import StatCard from '../components/StatCard';
import MessageVolume from '../components/MessageVolume';
import ConnectionsOverview from '../components/ConnectionsOverview';
import OverviewChart from '../components/OverviewChart';
import {
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatHistoryPoint,
  formatRangeLabel,
  formatBucketDuration
} from '../utils/periods';
import './AdminDashboard.css';

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

const computeTrend = (current, previous) => {
  if (previous == null || previous === 0) {
    return current ? '+100%' : '0%';
  }

  const variation = ((current - previous) / previous) * 100;
  const sign = variation >= 0 ? '+' : '';

  return `${sign}${variation.toFixed(1)}%`;
};

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodMeta, setPeriodMeta] = useState(buildPeriodRequest('1d').meta);
  const [trends, setTrends] = useState({
    messagesMinute: '0%',
    messagesHour: '0%',
    connectionsActive: '0%',
    connectionsNew: '0%'
  });
  const [selectedPeriod, setSelectedPeriod] = useState('1d');

  const prevMetricsRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchOverview = async (silent = false) => {
      try {
        const { params, meta } = buildPeriodRequest(selectedPeriod);
        setPeriodMeta(meta);

        if (!silent) {
          setLoading(true);
          setError(null);
        }

        const baseUrl = resolveBaseUrl();
        const url = baseUrl
          ? new URL('/api/v1/stats/overview', baseUrl)
          : new URL('/api/v1/stats/overview', window.location.origin);

        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(ADMIN_JWT ? { Authorization: `Bearer ${ADMIN_JWT}` } : {})
          },
          credentials: ADMIN_JWT ? 'omit' : 'include',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!mounted) return;

        const prev = prevMetricsRef.current;
        setTrends({
          messagesMinute: computeTrend(data.messages?.lastMinute ?? 0, prev?.messages?.lastMinute ?? null),
          messagesHour: computeTrend(data.messages?.lastHour ?? 0, prev?.messages?.lastHour ?? null),
          connectionsActive: computeTrend(data.connections?.active ?? 0, prev?.connections?.active ?? null),
          connectionsNew: computeTrend(data.connections?.newToday ?? 0, prev?.connections?.newToday ?? null)
        });

        prevMetricsRef.current = data;
        setOverview(data);
        setPeriodMeta((prev) => ({
          ...prev,
          rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prev.rangeLabel,
          bucketMinutes: data?.bucket?.minutes ?? prev.bucketMinutes
        }));
        setLoading(false);
      } catch (err) {
        if (!mounted || err.name === 'AbortError') return;
        console.error('Failed to load stats overview', err);
        setError('Failed to load metrics');
        setLoading(false);
      }
    };

    fetchOverview(false);
    const interval = setInterval(() => fetchOverview(true), 30000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [selectedPeriod]);

  if (loading && !overview) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading metrics…</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="dashboard-loading">
        <p>{error}</p>
      </div>
    );
  }

  const messages = overview?.messages ?? {
    lastMinute: 0,
    lastHour: 0,
    today: 0,
    total: 0,
    history: []
  };

  const connections = overview?.connections ?? {
    active: 0,
    newToday: 0,
    disconnections: 0,
    peak24h: 0,
    avgActive: 0,
    totalInteractions: 0,
    uniqueParticipants: 0,
    history: []
  };

  const bucketMinutes = overview?.bucket?.minutes ?? periodMeta.bucketMinutes;
  const bucketMeta = { ...periodMeta, bucketMinutes };

  const messageHistory = (messages.history ?? []).map((entry) =>
    formatHistoryPoint(entry, bucketMeta)
  );
  const connectionHistory = (connections.history ?? []).map((entry) =>
    formatHistoryPoint(entry, bucketMeta)
  );

  const findExtremum = (series, comparator) =>
    series.reduce((acc, entry) => {
      if (!acc) return entry;
      return comparator(entry.value, acc.value) ? entry : acc;
    }, null);

  const peakMessageBucket = findExtremum(messageHistory, (candidate, best) => candidate > best);
  const peakConnectionBucket = findExtremum(connectionHistory, (candidate, best) => candidate > best);

  const totalConnectionsBuckets = connectionHistory.reduce((sum, entry) => sum + entry.value, 0);
  const averageConnections = connectionHistory.length
    ? Math.round(totalConnectionsBuckets / connectionHistory.length)
    : 0;

  const chartData = messageHistory.map((entry, index) => ({
    label: entry.label,
    timestamp: entry.timestamp,
    messages: entry.value,
    connections: connectionHistory[index]?.value ?? 0
  }));

  const tableRows = messageHistory
    .map((entry, index) => ({
      timestamp: entry.timestamp,
      label: entry.label,
      messages: entry.value,
      connections: connectionHistory[index]?.value ?? 0
    }))
    .slice(-30)
    .reverse();

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-titles">
          <h2>Messaging Dashboard</h2>
          <p>Real-time message volume and user activity</p>
        </div>
        <div className="period-selector">
          {PERIOD_OPTIONS.map((option) => (
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

      <div className="dashboard-meta">
        <div>
          <span className="meta-label">Range:</span>
          <span className="meta-value">
            {periodMeta.rangeLabel || overview?.period?.label || 'Selected range'}
          </span>
        </div>
        <div>
          <span className="meta-label">Messages in period:</span>
          <span className="meta-value">{(overview?.messages?.total ?? 0).toLocaleString('en-US')}</span>
        </div>
        <div>
          <span className="meta-label">Interactions in period:</span>
          <span className="meta-value">{(overview?.connections?.totalInteractions ?? 0).toLocaleString('en-US')}</span>
        </div>
        <div>
          <span className="meta-label">Unique participants:</span>
          <span className="meta-value">{(overview?.connections?.uniqueParticipants ?? 0).toLocaleString('en-US')}</span>
        </div>
        <div>
          <span className="meta-label">Bucket size:</span>
          <span className="meta-value">{formatBucketDuration(bucketMinutes)}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Messages Last Minute"
          value={messages.lastMinute.toLocaleString('en-US')}
          icon="💬"
          color="#2196F3"
          trend={trends.messagesMinute}
        />

        <StatCard
          title="Messages Last Hour"
          value={messages.lastHour.toLocaleString('en-US')}
          icon="📈"
          color="#764ba2"
          trend={trends.messagesHour}
        />

        <StatCard
          title="Active Connections"
          value={connections.active.toLocaleString('en-US')}
          icon="🟢"
          color="#4CAF50"
          trend={trends.connectionsActive}
        />

        <StatCard
          title="New Connections Today"
          value={connections.newToday.toLocaleString('en-US')}
          icon="➕"
          color="#FF9800"
          trend={trends.connectionsNew}
        />
      </div>

      <div className="dashboard-panels">
        <div className="panel-card panel-chart">
          <div className="panel-heading">
            <h3 className="panel-title">Messages vs Connections</h3>
            <span className="panel-subtitle">
              {periodMeta.rangeLabel || overview?.period?.label || 'Selected range'}
            </span>
          </div>
          {(peakMessageBucket || peakConnectionBucket || averageConnections) && (
            <div className="panel-insights">
              {peakMessageBucket && (
                <div className="insight-card">
                  <span className="insight-label">Peak messages</span>
                  <span className="insight-value">
                    {peakMessageBucket.value.toLocaleString('en-US')}
                  </span>
                  <span className="insight-meta">{peakMessageBucket.label}</span>
                </div>
              )}
              {peakConnectionBucket && (
                <div className="insight-card">
                  <span className="insight-label">Peak connections</span>
                  <span className="insight-value">
                    {peakConnectionBucket.value.toLocaleString('en-US')}
                  </span>
                  <span className="insight-meta">{peakConnectionBucket.label}</span>
                </div>
              )}
              {averageConnections > 0 && (
                <div className="insight-card">
                  <span className="insight-label">Avg connections / bucket</span>
                  <span className="insight-value">
                    {averageConnections.toLocaleString('en-US')}
                  </span>
                  <span className="insight-meta">
                    Per {formatBucketDuration(bucketMinutes)}
                  </span>
                </div>
              )}
            </div>
          )}
          <OverviewChart data={chartData} meta={bucketMeta} />
        </div>

        <div className="panel-card">
          <MessageVolume
            history={messageHistory}
            messagesToday={messages.today}
            total={overview?.messages?.total ?? 0}
            bucketMinutes={bucketMinutes}
            periodLabel={periodMeta.rangeLabel || overview?.period?.label || ''}
          />
        </div>
        <div className="panel-card">
          <ConnectionsOverview
            summary={{
              active: connections.active,
              newConnections: connections.newToday,
              disconnections: connections.disconnections,
              peak: connections.peak24h,
              avgActive: connections.avgActive
            }}
            totals={{
              totalInteractions: overview?.connections?.totalInteractions ?? 0,
              uniqueParticipants: overview?.connections?.uniqueParticipants ?? 0,
              periodLabel: periodMeta.rangeLabel || overview?.period?.label || '',
              bucketMinutes
            }}
            history={connectionHistory}
          />
        </div>

        <div className="panel-card panel-table">
          <h3 className="panel-title">Bucket activity (latest 30)</h3>
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Messages</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.timestamp || row.label}>
                    <td>{row.label}</td>
                    <td>{row.messages.toLocaleString('en-US')}</td>
                    <td>{row.connections.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {messageHistory.length > 30 && (
              <div className="overview-table-note">
                Showing latest 30 buckets out of {messageHistory.length}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
