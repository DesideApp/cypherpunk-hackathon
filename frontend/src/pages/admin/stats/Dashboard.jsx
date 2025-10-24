import { useEffect, useRef, useState, useMemo } from "react";
import {
  StatCard,
  MessageVolume,
  ConnectionsOverview,
  OverviewChart,
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatHistoryPoint,
  formatRangeLabel,
  formatBucketDuration,
  fetchStatsOverview,
} from "@features/stats";
import "./shared.css";
import "./Dashboard.css";

const computeTrend = (current, previous) => {
  if (previous == null || previous === 0) {
    return current ? "+100%" : "0%";
  }
  const variation = ((current - previous) / previous) * 100;
  const sign = variation >= 0 ? "+" : "";
  return `${sign}${variation.toFixed(1)}%`;
};

const FALLBACK_PRODUCT = {
  tokens: { total: 0, last24h: 0 },
  blinks: {
    metadataHits: 0,
    metadataHits24h: 0,
    executes: 0,
    executes24h: 0,
    successRate24h: null,
    volumeTotal: 0,
    volume24h: 0,
  },
  naturalCommands: {
    parsed: 0,
    executed: 0,
    rejected: 0,
    failed: 0,
    parsed24h: 0,
    executed24h: 0,
    rejected24h: 0,
    failed24h: 0,
  },
  messaging: {
    dmStarted: 0,
    dmAccepted: 0,
    relayMessages: 0,
    dmStarted24h: 0,
    dmAccepted24h: 0,
    relayMessages24h: 0,
  },
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodMeta, setPeriodMeta] = useState(buildPeriodRequest("1d").meta);
  const [trends, setTrends] = useState({
    messagesMinute: "0%",
    messagesHour: "0%",
    connectionsActive: "0%",
    connectionsNew: "0%",
  });
  const [selectedPeriod, setSelectedPeriod] = useState("1d");

  const prevMetricsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async (silent = false) => {
      try {
        const { params, meta } = buildPeriodRequest(selectedPeriod);
        setPeriodMeta(meta);
        if (!silent) {
          setLoading(true);
          setError(null);
        }

        const data = await fetchStatsOverview(params);
        if (cancelled) return;

        const prev = prevMetricsRef.current;
        setTrends({
          messagesMinute: computeTrend(data?.messages?.lastMinute ?? 0, prev?.messages?.lastMinute ?? null),
          messagesHour: computeTrend(data?.messages?.lastHour ?? 0, prev?.messages?.lastHour ?? null),
          connectionsActive: computeTrend(data?.connections?.active ?? 0, prev?.connections?.active ?? null),
          connectionsNew: computeTrend(data?.connections?.newToday ?? 0, prev?.connections?.newToday ?? null),
        });

        prevMetricsRef.current = data;
        setOverview(data);
        setPeriodMeta((prevMeta) => ({
          ...prevMeta,
          rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prevMeta.rangeLabel,
          bucketMinutes: data?.bucket?.minutes ?? prevMeta.bucketMinutes,
        }));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load stats overview", err);
        setError("Failed to load metrics");
        setLoading(false);
      }
    };

    loadOverview(false);
    const interval = setInterval(() => loadOverview(true), 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedPeriod]);

  const messages = useMemo(
    () =>
      overview?.messages ?? {
        lastMinute: 0,
        lastHour: 0,
        today: 0,
        total: 0,
        history: [],
      },
    [overview]
  );

  const connections = useMemo(
    () =>
      overview?.connections ?? {
        active: 0,
        newToday: 0,
        disconnections: 0,
        peak24h: 0,
        avgActive: 0,
        totalInteractions: 0,
        uniqueParticipants: 0,
        history: [],
      },
    [overview]
  );

  const product = useMemo(() => overview?.productInsights ?? FALLBACK_PRODUCT, [overview]);

  const bucketMinutes = overview?.bucket?.minutes ?? periodMeta.bucketMinutes;
  const bucketMeta = useMemo(
    () => ({ ...periodMeta, bucketMinutes }),
    [periodMeta, bucketMinutes]
  );

  const messageHistory = useMemo(
    () =>
      (messages.history ?? []).map((entry) =>
        formatHistoryPoint(entry, bucketMeta)
      ),
    [messages.history, bucketMeta]
  );

  const connectionHistory = useMemo(
    () =>
      (connections.history ?? []).map((entry) =>
        formatHistoryPoint(entry, bucketMeta)
      ),
    [connections.history, bucketMeta]
  );

  const chartData = messageHistory.map((entry, index) => ({
    label: entry.label,
    timestamp: entry.timestamp,
    messages: entry.value,
    connections: connectionHistory[index]?.value ?? 0,
  }));

  const tableRows = [...chartData].slice(-30).reverse();

  const findExtremum = (series, comparator) =>
    series.reduce((acc, entry) => {
      if (!acc) return entry;
      return comparator(entry.value, acc.value) ? entry : acc;
    }, null);

  const totalConnectionsBuckets = connectionHistory.reduce((sum, entry) => sum + entry.value, 0);
  const averageConnectionsLocal = connectionHistory.length
    ? Math.round(totalConnectionsBuckets / connectionHistory.length)
    : 0;

  const peakMessageBucket = findExtremum(messageHistory, (candidate, best) => candidate > best);
  const peakConnectionBucket = findExtremum(connectionHistory, (candidate, best) => candidate > best);

  // Prefer backend-derived metrics for consistency; fall back to client-side estimates
  const peakMessages = typeof overview?.messages?.peak === 'number'
    ? overview.messages.peak
    : (peakMessageBucket?.value ?? 0);
  const peakConnections = typeof overview?.connections?.peak === 'number'
    ? overview.connections.peak
    : (peakConnectionBucket?.value ?? 0);
  const avgConnections = typeof overview?.connections?.avgPerBucket === 'number'
    ? overview.connections.avgPerBucket
    : averageConnectionsLocal;

  // Messaging latency & ack metrics from backend
  const deliveryP95 = typeof overview?.messages?.deliveryLatencyP95 === 'number'
    ? overview.messages.deliveryLatencyP95
    : null;
  const deliveryP50 = typeof overview?.messages?.deliveryLatencyP50 === 'number'
    ? overview.messages.deliveryLatencyP50
    : null;
  const ackP95 = typeof overview?.messages?.ackLatencyP95 === 'number'
    ? overview.messages.ackLatencyP95
    : null;
  const ackP50 = typeof overview?.messages?.ackLatencyP50 === 'number'
    ? overview.messages.ackLatencyP50
    : null;
  const ackRate = typeof overview?.messages?.ackRate === 'number' ? overview.messages.ackRate : null;
  // RTC overview
  const rtc = overview?.rtc || {};

  if (loading && !overview) {
    return (
      <div className="stats-panel__loading">
        <div className="stats-panel__spinner" />
        <p>Cargando métricas…</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="stats-panel__loading">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="stats-dashboard">
      <div className="stats-dashboard__header">
        <div>
          <h2>Messaging Dashboard</h2>
          <p>Actividad en tiempo real de mensajes y usuarios.</p>
        </div>

        <div className="period-selector">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`period-btn ${selectedPeriod === option.key ? "active" : ""}`}
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
            {periodMeta.rangeLabel || overview?.period?.label || "Selected range"}
          </span>
        </div>
        <div>
          <span className="meta-label">Messages in period:</span>
          <span className="meta-value">{(overview?.messages?.total ?? 0).toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className="meta-label">Interactions in period:</span>
          <span className="meta-value">{(overview?.connections?.totalInteractions ?? 0).toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className="meta-label">Unique participants:</span>
          <span className="meta-value">{(overview?.connections?.uniqueParticipants ?? 0).toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className="meta-label">Bucket size:</span>
          <span className="meta-value">{formatBucketDuration(bucketMinutes)}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Messages last minute"
          value={messages.lastMinute.toLocaleString("en-US")}
          icon="💬"
          color="#6366f1"
          trend={trends.messagesMinute}
        />
        <StatCard
          title="Messages last hour"
          value={messages.lastHour.toLocaleString("en-US")}
          icon="📈"
          color="#8b5cf6"
          trend={trends.messagesHour}
        />
        <StatCard
          title="Active connections"
          value={connections.active.toLocaleString("en-US")}
          icon="🟢"
          color="#22c55e"
          trend={trends.connectionsActive}
        />
        <StatCard
          title="New connections today"
          value={connections.newToday.toLocaleString("en-US")}
          icon="➕"
          color="#f97316"
          trend={trends.connectionsNew}
        />
      </div>

      <div className="stats-grid secondary">
        <StatCard
          title="Tokens añadidos (24h)"
          value={product.tokens.last24h.toLocaleString("en-US")}
          icon="🪙"
          color="#7b1fa2"
          subtitle={`Total: ${product.tokens.total.toLocaleString("en-US")}`}
        />
        <StatCard
          title="Blink executes (24h)"
          value={product.blinks.executes24h.toLocaleString("en-US")}
          icon="⚡"
          color="#f472b6"
          subtitle={`${product.blinks.metadataHits24h.toLocaleString("en-US")} hits • ${product.blinks.volume24h.toLocaleString("en-US")} vol • ${product.blinks.successRate24h != null ? `${product.blinks.successRate24h}% success` : "no data"}`}
        />
        <StatCard
          title="Commands executed (24h)"
          value={product.naturalCommands.executed24h.toLocaleString("en-US")}
          icon="🤖"
          color="#0ea5e9"
          subtitle={`${product.naturalCommands.parsed24h.toLocaleString("en-US")} parsed • ${product.naturalCommands.rejected24h.toLocaleString("en-US")} rejected`}
        />
        <StatCard
          title="DM requests (24h)"
          value={product.messaging.dmStarted24h.toLocaleString("en-US")}
          icon="📨"
          color="#10b981"
          subtitle={`${product.messaging.dmAccepted24h.toLocaleString("en-US")} accepted • ${product.messaging.relayMessages24h.toLocaleString("en-US")} relay msgs`}
        />
      </div>

      {/* RTC quality metrics */}
      <div className="stats-grid secondary">
        <StatCard
          title="RTC success rate"
          value={typeof rtc.successRate === 'number' ? `${rtc.successRate.toFixed(2)}%` : '—'}
          icon="📶"
          color="#3b82f6"
          subtitle={`offers: ${rtc.offers ?? 0} • established: ${rtc.established ?? 0}`}
        />
        <StatCard
          title="RTC TTC p95"
          value={typeof rtc.ttcP95 === 'number' ? `${Math.round(rtc.ttcP95)} ms` : '—'}
          icon="⏱️"
          color="#2563eb"
          subtitle={typeof rtc.ttcP50 === 'number' ? `p50: ${Math.round(rtc.ttcP50)} ms` : ''}
        />
        <StatCard
          title="RTC fallback"
          value={typeof rtc?.fallback?.ratioPct === 'number' ? `${rtc.fallback.ratioPct.toFixed(2)}%` : '—'}
          icon="↩️"
          color="#0ea5e9"
          subtitle={`count: ${rtc?.fallback?.count ?? 0}`}
        />
      </div>
      {/* Messaging quality metrics */}
      <div className="stats-grid secondary">
        <StatCard
          title="Delivery p95"
          value={deliveryP95 != null ? `${Math.round(deliveryP95)} ms` : '—'}
          icon="📬"
          color="#16a34a"
          subtitle={deliveryP50 != null ? `p50: ${Math.round(deliveryP50)} ms` : ''}
        />
        <StatCard
          title="ACK p95"
          value={ackP95 != null ? `${Math.round(ackP95)} ms` : '—'}
          icon="✅"
          color="#059669"
          subtitle={ackP50 != null ? `p50: ${Math.round(ackP50)} ms` : ''}
        />
        <StatCard
          title="ACK rate"
          value={ackRate != null ? `${ackRate.toFixed(2)}%` : '—'}
          icon="📥"
          color="#22c55e"
          subtitle="% delivered → acked"
        />
      </div>

      <div className="dashboard-panels">
        <div className="panel-card panel-chart">
          <div className="panel-heading">
            <h3 className="panel-title">Messages vs connections</h3>
            <span className="panel-subtitle">
              {periodMeta.rangeLabel || overview?.period?.label || "Selected range"}
            </span>
          </div>
          {(peakMessageBucket || peakConnectionBucket || avgConnections) && (
            <div className="panel-insights">
              {peakMessageBucket && (
                <Insight label="Peak messages" value={peakMessages} meta={peakMessageBucket.label} />
              )}
              {peakConnectionBucket && (
                <Insight label="Peak connections" value={peakConnections} meta={peakConnectionBucket.label} />
              )}
              {avgConnections > 0 && (
                <Insight
                  label="Avg connections / bucket"
                  value={avgConnections}
                  meta={`Per ${formatBucketDuration(bucketMinutes)}`}
                />
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
            periodLabel={periodMeta.rangeLabel || overview?.period?.label || ""}
          />
        </div>

        <div className="panel-card">
          <ConnectionsOverview
            summary={{
              active: connections.active,
              newConnections: connections.newToday,
              disconnections: connections.disconnections,
              peak: connections.peak24h,
              avgActive: connections.avgActive,
            }}
            totals={{
              totalInteractions: overview?.connections?.totalInteractions ?? 0,
              uniqueParticipants: overview?.connections?.uniqueParticipants ?? 0,
              periodLabel: periodMeta.rangeLabel || overview?.period?.label || "",
              bucketMinutes,
            }}
            history={connectionHistory}
          />
        </div>
      </div>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Latest buckets</h3>
          <span className="panel-subtitle">Messages & connections (max 30)</span>
        </div>
        <div className="panel-table__wrapper">
          <table>
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
                  <td>{row.messages.toLocaleString("en-US")}</td>
                  <td>{row.connections.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Insight({ label, value, meta }) {
  return (
    <div className="insight-card">
      <span className="insight-label">{label}</span>
      <span className="insight-value">{value.toLocaleString("en-US")}</span>
      <span className="insight-meta">{meta}</span>
    </div>
  );
}
