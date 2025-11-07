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
  fetchRelayPending,
  fetchRelayOverview,
  fetchAdoptionOverview,
  fetchAdoptionFunnel,
  fetchJobStatuses,
  fetchRelayErrors,
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

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const FALLBACK_PRODUCT = {
  actions: {
    send: { total: 0, count24h: 0, volume24h: 0 },
    request: { total: 0, count24h: 0, amount24h: 0 },
    buy: { total: 0, count24h: 0, volume24h: 0 },
    agreement: { total: 0, created24h: 0, signed24h: 0, settled24h: 0 },
  },
  messaging: {
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
  const [relaySnapshot, setRelaySnapshot] = useState({ pendingCount: 0, pendingBytes: 0, purgedCount: 0, purgedBytes: 0 });
  const [adoptionOverview, setAdoptionOverview] = useState(null);
  const [adoptionFunnel, setAdoptionFunnel] = useState(null);
  const [adoptionLoading, setAdoptionLoading] = useState(true);
  const [adoptionWindowDays, setAdoptionWindowDays] = useState(1);
  const [jobStatuses, setJobStatuses] = useState({ jobs: {}, metrics: null });
  const [jobStatusLoading, setJobStatusLoading] = useState(true);
  const [jobStatusError, setJobStatusError] = useState(null);
  const [relayErrors, setRelayErrors] = useState({ errors: [], range: null });
  const [relayErrorsError, setRelayErrorsError] = useState(null);

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
        // Load relay snapshot in parallel
        try {
          const [pendingRes, overviewRes] = await Promise.all([
            fetchRelayPending({ limit: 1 }),
            fetchRelayOverview(),
          ]);
          if (!cancelled) {
            const purgedCount = (overviewRes?.purges || []).reduce((s, p) => s + (p.count || 0), 0);
            const purgedBytes = (overviewRes?.purges || []).reduce((s, p) => s + (p.bytes || 0), 0);
            setRelaySnapshot({
              pendingCount: pendingRes?.totals?.count || 0,
              pendingBytes: pendingRes?.totals?.bytes || 0,
              purgedCount,
              purgedBytes,
            });
          }
        } catch {}
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

  useEffect(() => {
    let cancelled = false;
    const resolveWindowDays = (periodKey) => {
      if (periodKey === "1h" || periodKey === "1d") return 1;
      if (periodKey === "7d") return 7;
      return 14;
    };

    const loadAdoption = async () => {
      try {
        const windowDays = resolveWindowDays(selectedPeriod);
        setAdoptionWindowDays(windowDays);
        setAdoptionLoading(true);
        const [overviewRes, funnelRes] = await Promise.all([
          fetchAdoptionOverview({ period: selectedPeriod }),
          fetchAdoptionFunnel({ period: selectedPeriod, windowDays }),
        ]);
        if (cancelled) return;
        setAdoptionOverview(overviewRes);
        setAdoptionFunnel(funnelRes);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load adoption metrics", err);
          setAdoptionOverview(null);
          setAdoptionFunnel(null);
        }
      } finally {
        if (!cancelled) setAdoptionLoading(false);
      }
    };

    loadAdoption();
    const interval = setInterval(loadAdoption, 180_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedPeriod]);

  useEffect(() => {
    let cancelled = false;

    const loadJobStatuses = async () => {
      try {
        setJobStatusLoading(true);
        setJobStatusError(null);
        const data = await fetchJobStatuses();
        if (!cancelled) setJobStatuses(data);
        const errorsData = await fetchRelayErrors({ limit: 15 });
        if (!cancelled) setRelayErrors(errorsData);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load job statuses", err);
          setJobStatusError("Failed to load job statuses");
          setRelayErrorsError("Failed to load relay errors");
        }
      } finally {
        if (!cancelled) setJobStatusLoading(false);
      }
    };

    loadJobStatuses();
    const interval = setInterval(loadJobStatuses, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
    () => {
      const source = overview?.connections ?? {};
      const uniqueParticipants = source.uniqueParticipants ?? 0;
      const newParticipants = source.newParticipants ?? 0;
      const returningParticipants =
        source.returningParticipants ?? Math.max(0, uniqueParticipants - newParticipants);
      const returningRate =
        source.returningRate ??
        (uniqueParticipants > 0
          ? Number(((returningParticipants / uniqueParticipants) * 100).toFixed(2))
          : null);
      return {
        active: source.active ?? 0,
        newToday: source.newToday ?? 0,
        disconnections: source.disconnections ?? 0,
        peak24h: source.peak24h ?? 0,
        avgActive: source.avgActive ?? 0,
        totalInteractions: source.totalInteractions ?? 0,
        uniqueParticipants,
        newParticipants,
        returningParticipants,
        returningRate,
        history: source.history ?? [],
      };
    },
    [overview]
  );

  const jobItems = useMemo(() => {
    const entries = Object.entries(jobStatuses?.jobs || {});
    return entries.map(([name, status]) => ({ name, ...status }));
  }, [jobStatuses]);

  const product = useMemo(() => overview?.productInsights ?? FALLBACK_PRODUCT, [overview]);
  const actionsProduct = product.actions ?? FALLBACK_PRODUCT.actions;

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
  const formatNumber = (value) => Number(value ?? 0).toLocaleString("en-US");
  const formatAmount = (value, digits = 4) => {
    if (value === null || value === undefined) return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return numeric.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  };
  const formatPercent = (value) => (value != null ? `${Number(value).toFixed(2)}%` : "—");
  const formatDuration = (ms) => {
    if (ms == null) return "—";
    if (ms === 0) return "0s";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  };

  const jobStatusClass = (status) => {
    if (status === 'success') return 'job-status--success';
    if (status === 'error') return 'job-status--error';
    if (status === 'running') return 'job-status--running';
    return 'job-status--unknown';
  };

  const returningRateDisplay = formatPercent(connections.returningRate);
  const adoptionUsers = adoptionOverview?.users ?? {
    dau: 0,
    wau: 0,
    mau: 0,
  };
  const dauWauMauValue =
    adoptionLoading && !adoptionOverview
      ? "..."
      : `${formatNumber(adoptionUsers.dau)} / ${formatNumber(adoptionUsers.wau)} / ${formatNumber(adoptionUsers.mau)}`;
  const wauMauRatio =
    adoptionUsers?.mau > 0
      ? Number(((adoptionUsers.wau / adoptionUsers.mau) * 100).toFixed(2))
      : null;
  const activationA = adoptionFunnel?.activationA ?? null;
  const activationB = adoptionFunnel?.activationB ?? null;
  const activationAValue =
    adoptionLoading && !adoptionFunnel ? "..." : activationA ? formatPercent(activationA.conversionPct) : "—";
  const activationBValue =
    adoptionLoading && !adoptionFunnel ? "..." : activationB ? formatPercent(activationB.conversionPct) : "—";
  const activationASubtitle = activationA
    ? `Count: ${formatNumber(activationA.count ?? 0)} • p50 ${formatDuration(activationA.ttaP50ms)} • p95 ${formatDuration(activationA.ttaP95ms)}`
    : `Window ${adoptionWindowDays}d`;
  const activationBSubtitle = activationB
    ? `Count: ${formatNumber(activationB.count ?? 0)} • p50 ${formatDuration(activationB.ttaP50ms)} • p95 ${formatDuration(activationB.ttaP95ms)}`
    : `Window ${adoptionWindowDays}d`;

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
  // Relay snapshot helpers
  const relayPendingCount = relaySnapshot.pendingCount || 0;
  const relayPendingBytes = relaySnapshot.pendingBytes || 0;
  const relayPurgedCount = relaySnapshot.purgedCount || 0;
  const relayPurgedBytes = relaySnapshot.purgedBytes || 0;
  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

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

      <div className="dashboard-section">
        <h3 className="dashboard-section__title">Highlights</h3>
        <div className="stats-grid highlight">
          <StatCard
            title="Messages last minute"
            value={formatNumber(messages.lastMinute)}
            icon="💬"
            color="#6366f1"
            trend={trends.messagesMinute}
            subtitle="vs previous snapshot"
          />
          <StatCard
            title="Active wallets (period)"
            value={formatNumber(connections.uniqueParticipants)}
            icon="👥"
            color="#0ea5e9"
            subtitle={`New: ${formatNumber(connections.newParticipants)} • Returning: ${formatNumber(connections.returningParticipants)}`}
          />
          <StatCard
            title="Returning rate"
            value={returningRateDisplay}
            icon="🔁"
            color="#3b82f6"
            subtitle={`Returning ${formatNumber(connections.returningParticipants)} of ${formatNumber(connections.uniqueParticipants)}`}
          />
          <StatCard
            title="Activation A"
            value={activationAValue}
            icon="🎯"
            color="#10b981"
            subtitle={activationASubtitle}
          />
          <StatCard
            title="Activation B"
            value={activationBValue}
            icon="🚀"
            color="#14b8a6"
            subtitle={activationBSubtitle}
          />
          <StatCard
            title="DAU / WAU / MAU"
            value={dauWauMauValue}
            icon="📊"
            color="#f97316"
            subtitle={wauMauRatio != null ? `WAU/MAU ${formatPercent(wauMauRatio)}` : "WAU/MAU —"}
          />
        </div>
      </div>

      {/* Relay snapshot */}
      <div className="dashboard-section">
        <h3 className="dashboard-section__title">Relay health</h3>
        <div className="stats-grid secondary">
          <StatCard
            title="Relay pending"
            value={relayPendingCount.toLocaleString('en-US')}
            icon="📦"
            color="#8b5cf6"
            subtitle={formatBytes(relayPendingBytes)}
          />
          <StatCard
            title="Purged (24h)"
            value={relayPurgedCount.toLocaleString('en-US')}
            icon="🧹"
            color="#7c3aed"
            subtitle={formatBytes(relayPurgedBytes)}
          />
        </div>
      </div>

      <div className="dashboard-section jobs-section">
        <h3 className="dashboard-section__title">Jobs & alerts</h3>
        {jobStatusError && <p className="jobs-status__notice jobs-status__notice--error">{jobStatusError}</p>}
        {jobStatusLoading && !jobItems.length ? (
          <div className="stats-panel__loading"><div className="stats-panel__spinner" /><p>Cargando estado de jobs…</p></div>
        ) : (
          <div className="jobs-status">
            {jobItems.length === 0 ? (
              <p className="jobs-status__empty">Aún no hay ejecuciones registradas.</p>
            ) : (
              jobItems.map((job) => (
                <div key={job.name} className={`jobs-status__item ${jobStatusClass(job.status)}`}>
                  <div className="jobs-status__header">
                    <span className="jobs-status__name">{job.name}</span>
                    <span className="jobs-status__status">{job.status ?? 'unknown'}</span>
                  </div>
                  <div className="jobs-status__meta">
                    <span>Última ejecución: {formatDateTime(job.finishedAt || job.startedAt)}</span>
                    <span>Duración: {formatDuration(job.durationMs)}</span>
                  </div>
                  {job.result && Object.keys(job.result).length > 0 && (
                    <div className="jobs-status__result">
                      {Object.entries(job.result).map(([key, value]) => (
                        <span key={key}>
                          {key}: {typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                  {job.error && (
                    <div className="jobs-status__error">
                      <span>Error:</span>
                      <code>{job.error}</code>
                    </div>
                  )}
                </div>
              ))
            )}
            {jobStatuses.metrics && (
              <div className="jobs-status__metrics">
                <h4>Reconciliación relay ↔ history</h4>
                <div className="jobs-status__metrics-grid">
                  <div>
                    <span className="label">Revisados</span>
                    <span className="value">{(jobStatuses.metrics.relayHistoryChecked ?? 0).toLocaleString('en-US')}</span>
                  </div>
                  <div>
                    <span className="label">Faltan en history</span>
                    <span className="value">{(jobStatuses.metrics.relayHistoryMissingInHistory ?? 0).toLocaleString('en-US')}</span>
                  </div>
                  <div>
                    <span className="label">Reparados</span>
                    <span className="value">{(jobStatuses.metrics.relayHistoryRepaired ?? 0).toLocaleString('en-US')}</span>
                  </div>
                  <div>
                    <span className="label">Faltan en relay</span>
                    <span className="value">{(jobStatuses.metrics.relayHistoryMissingInRelay ?? 0).toLocaleString('en-US')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {relayErrorsError && (
          <p className="jobs-status__notice jobs-status__notice--error">{relayErrorsError}</p>
        )}
        {!relayErrorsError && relayErrors?.errors?.length > 0 && (
          <div className="relay-errors">
            <h4>Errores relay (últimas 24h)</h4>
            <ul>
              {relayErrors.errors.map((item) => (
                <li key={item.code}>
                  <span className="relay-error__code">{item.code}</span>
                  <span className="relay-error__count">{item.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          title="Send (24h)"
          value={actionsProduct.send.count24h.toLocaleString("en-US")}
          icon="✉️"
          color="#7b1fa2"
          subtitle={`Volumen ${formatAmount(actionsProduct.send.volume24h)} • Total ${formatNumber(actionsProduct.send.total)}`}
        />
        <StatCard
          title="Requests (24h)"
          value={actionsProduct.request.count24h.toLocaleString("en-US")}
          icon="🧾"
          color="#f97316"
          subtitle={`Importe ${formatAmount(actionsProduct.request.amount24h)} • Total ${formatNumber(actionsProduct.request.total)}`}
        />
        <StatCard
          title="Buy (24h)"
          value={actionsProduct.buy.count24h.toLocaleString("en-US")}
          icon="🛒"
          color="#0ea5e9"
          subtitle={`Volumen ${formatAmount(actionsProduct.buy.volume24h)} • Total ${formatNumber(actionsProduct.buy.total)}`}
        />
        <StatCard
          title="Agreements (24h)"
          value={actionsProduct.agreement.created24h.toLocaleString("en-US")}
          icon="🤝"
          color="#10b981"
          subtitle={`Firmados ${formatNumber(actionsProduct.agreement.signed24h)} • Settled ${formatNumber(actionsProduct.agreement.settled24h)}`}
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
