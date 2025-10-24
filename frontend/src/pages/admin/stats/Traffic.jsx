import { useState, useEffect, useMemo } from "react";
import {
  OverviewChart,
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatHistoryPoint,
  formatBucketDuration,
  formatRangeLabel,
  fetchStatsOverview,
} from "@features/stats";
import "./shared.css";
import "./Traffic.css";

const TRAFFIC_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((option) => option.key !== "1h");

export default function Traffic() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("1d");
  const [periodMeta, setPeriodMeta] = useState(buildPeriodRequest("1d").meta);

  useEffect(() => {
    let cancelled = false;

    const loadTraffic = async (silent = false) => {
      try {
        const { params, meta } = buildPeriodRequest(selectedPeriod);
        setPeriodMeta(meta);
        if (!silent) setLoading(true);

        const data = await fetchStatsOverview(params);
        if (cancelled) return;

        setOverview(data);
        setPeriodMeta((prev) => ({
          ...prev,
          rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prev.rangeLabel,
          bucketMinutes: data?.bucket?.minutes ?? prev.bucketMinutes,
        }));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load traffic stats", err);
        setError("Failed to load traffic stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTraffic(false);
    const interval = setInterval(() => loadTraffic(true), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedPeriod]);

  const messages = overview?.messages ?? { total: 0, history: [] };
  const connections = overview?.connections ?? {
    totalInteractions: 0,
    uniqueParticipants: 0,
    peak24h: 0,
    avgActive: 0,
    history: [],
  };
  const product = overview?.productInsights ?? {
    tokens: { last24h: 0 },
    blinks: { executes24h: 0, successRate24h: null },
    naturalCommands: { executed24h: 0 },
    messaging: { relayMessages24h: 0 },
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
    connections: connectionHistory[index]?.value ?? 0,
  }));

  const latestBuckets = chartData.slice(-30).reverse();

  const findExtremum = (series, comparator) =>
    series.reduce((acc, entry) => {
      if (!acc) return entry;
      return comparator(entry.value, acc.value) ? entry : acc;
    }, null);

  const pickPercentile = (series, percentile) => {
    if (!series.length) return null;
    const sorted = [...series].sort((a, b) => a.value - b.value);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
    return sorted[index];
  };

  const peakMessageBucket = findExtremum(messageHistory, (candidate, best) => candidate > best);
  const peakConnectionBucket = findExtremum(connectionHistory, (candidate, best) => candidate > best);
  const p95MessageBucket = pickPercentile(messageHistory, 95);
  const p95ConnectionBucket = pickPercentile(connectionHistory, 95);

  const totalMessages = messages.total ?? 0;
  const totalInteractions = connections.totalInteractions ?? 0;

  const averageMessagesPerBucketLocal = messageHistory.length
    ? Math.round(totalMessages / messageHistory.length)
    : 0;
  const averageConnectionsPerBucketLocal = connectionHistory.length
    ? Math.round(connectionHistory.reduce((sum, entry) => sum + entry.value, 0) / connectionHistory.length)
    : 0;

  // Prefer backend-derived stats; keep local for labels/meta
  const peakMessages = typeof overview?.messages?.peak === 'number' ? overview.messages.peak : (peakMessageBucket?.value ?? 0);
  const peakConnections = typeof overview?.connections?.peak === 'number' ? overview.connections.peak : (peakConnectionBucket?.value ?? 0);
  const p95Messages = typeof overview?.messages?.p95 === 'number' ? overview.messages.p95 : (p95MessageBucket?.value ?? 0);
  const p95Connections = typeof overview?.connections?.p95 === 'number' ? overview.connections.p95 : (p95ConnectionBucket?.value ?? 0);
  const averageMessagesPerBucket = typeof overview?.messages?.avgPerBucket === 'number' ? overview.messages.avgPerBucket : averageMessagesPerBucketLocal;
  const averageConnectionsPerBucket = typeof overview?.connections?.avgPerBucket === 'number' ? overview.connections.avgPerBucket : averageConnectionsPerBucketLocal;

  const loadRatio =
    averageMessagesPerBucket > 0 && peakMessages
      ? (peakMessages / averageMessagesPerBucket).toFixed(1)
      : null;

  // Messaging quality (from backend overview)
  const deliveryP95 = typeof overview?.messages?.deliveryLatencyP95 === 'number' ? overview.messages.deliveryLatencyP95 : null;
  const deliveryP50 = typeof overview?.messages?.deliveryLatencyP50 === 'number' ? overview.messages.deliveryLatencyP50 : null;
  const ackP95 = typeof overview?.messages?.ackLatencyP95 === 'number' ? overview.messages.ackLatencyP95 : null;
  const ackP50 = typeof overview?.messages?.ackLatencyP50 === 'number' ? overview.messages.ackLatencyP50 : null;
  const ackRate = typeof overview?.messages?.ackRate === 'number' ? overview.messages.ackRate : null;
  const rtc = overview?.rtc || {};

  return (
    <div className="traffic-panel">
      <div className="traffic-panel__header">
        <div>
          <h2>Traffic Overview</h2>
          <p>Carga, endpoints y uso agregado del sistema.</p>
        </div>
        <div className="traffic-period">
          {TRAFFIC_PERIOD_OPTIONS.map((option) => (
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

      {loading && !overview ? (
        <div className="stats-panel__loading">
          <div className="stats-panel__spinner" />
          <p>Cargando métricas…</p>
        </div>
      ) : error && !overview ? (
        <div className="stats-panel__loading">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <section className="traffic-summary">
            <SummaryCard title="Messages (period)" value={totalMessages} highlight="#6366f1" />
            <SummaryCard title="Interactions" value={totalInteractions} highlight="#22c55e" />
            <SummaryCard title="Unique participants" value={connections.uniqueParticipants ?? 0} highlight="#f97316" />
            <SummaryCard
              title="Relay msgs (24h)"
              value={product.messaging.relayMessages24h ?? 0}
              highlight="#8b5cf6"
            />
          </section>

          <section className="traffic-panels">
            <div className="panel-card panel-chart">
              <div className="panel-heading">
                <h3 className="panel-title">Messages vs connections</h3>
                <span className="panel-subtitle">
                  {periodMeta.rangeLabel || overview?.period?.label || "Selected range"}
                </span>
              </div>
              <OverviewChart data={chartData} meta={{ ...periodMeta, bucketMinutes }} />
            </div>

            <div className="panel-card">
              <h3 className="panel-title">Load highlights</h3>
              <ul className="traffic-highlights">
                <Highlight label="Peak messages" value={peakMessages} meta={peakMessageBucket?.label} />
                <Highlight label="Peak connections" value={peakConnections} meta={peakConnectionBucket?.label} />
                <Highlight label="P95 messages" value={p95Messages} meta={p95MessageBucket?.label} />
                <Highlight label="P95 connections" value={p95Connections} meta={p95ConnectionBucket?.label} />
                <Highlight
                  label="Average messages / bucket"
                  value={averageMessagesPerBucket}
                  meta={formatBucketDuration(bucketMinutes)}
                />
                <Highlight
                  label="Average connections / bucket"
                  value={averageConnectionsPerBucket}
                  meta={formatBucketDuration(bucketMinutes)}
                />
                {loadRatio && <Highlight label="Peak vs avg ratio" value={loadRatio} meta="x" />}
                {/* Messaging quality */}
                <Highlight label="Delivery p95" value={deliveryP95 != null ? Math.round(deliveryP95) : null} meta="ms" />
                <Highlight label="ACK p95" value={ackP95 != null ? Math.round(ackP95) : null} meta="ms" />
                <Highlight label="ACK rate" value={ackRate != null ? Number(ackRate.toFixed(2)) : null} meta="%" />
                <Highlight label="RTC success" value={typeof rtc.successRate === 'number' ? Number(rtc.successRate.toFixed(2)) : null} meta="%" />
                <Highlight label="RTC TTC p95" value={typeof rtc.ttcP95 === 'number' ? Math.round(rtc.ttcP95) : null} meta="ms" />
                <Highlight label="RTC fallback" value={typeof rtc?.fallback?.ratioPct === 'number' ? Number(rtc.fallback.ratioPct.toFixed(2)) : null} meta="%" />
              </ul>
            </div>
          </section>

          <section className="panel-card panel-table">
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
                  {latestBuckets.map((row) => (
                    <tr key={row.timestamp || row.label}>
                      <td>{row.label}</td>
                      <td>{row.messages.toLocaleString("en-US")}</td>
                      <td>{row.connections.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, highlight }) {
  return (
    <div className="traffic-summary__card" style={{ borderColor: highlight }}>
      <span className="traffic-summary__label">{title}</span>
      <span className="traffic-summary__value">{value.toLocaleString("en-US")}</span>
    </div>
  );
}

function Highlight({ label, value, meta }) {
  if (value == null) return null;
  return (
    <li>
      <span>{label}</span>
      <strong>{value.toLocaleString("en-US")}</strong>
      {meta && <span className="meta">{meta}</span>}
    </li>
  );
}
