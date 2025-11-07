import { useEffect, useMemo, useState } from "react";
import {
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatRangeLabel,
  formatBucketDuration,
  fetchStatsOverview,
  fetchAdminUsers,
  fetchTopUsers,
  fetchRelayUsage,
  fetchRecentLogins,
  fetchAdoptionOverview,
  fetchAdoptionFunnel,
  fetchRelayCapacity,
  fetchActionsOverview,
} from "@features/stats";
import "./shared.css";
import "./Users.css";

const USER_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((option) => ["1h", "1d", "7d"].includes(option.key));

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("lastLogin");
  const [sortOrder, setSortOrder] = useState("desc");
  const [stats, setStats] = useState(null);
  const [statsMeta, setStatsMeta] = useState(buildPeriodRequest("1h").meta);
  const [statsPeriod, setStatsPeriod] = useState("1h");
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  // Extras
  const [topSent, setTopSent] = useState([]);
  const [topReceived, setTopReceived] = useState([]);
  const [relayUsage, setRelayUsage] = useState([]);
  const [recentLogins, setRecentLogins] = useState([]);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [adoptionOverview, setAdoptionOverview] = useState(null);
  const [adoptionFunnel, setAdoptionFunnel] = useState(null);
  const [adoptionLoading, setAdoptionLoading] = useState(true);
  const [adoptionError, setAdoptionError] = useState(null);
  const [relayCapacity, setRelayCapacity] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [capacityError, setCapacityError] = useState(null);
  const [actionsInsights, setActionsInsights] = useState(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState(null);
  const [showActionMetrics, setShowActionMetrics] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      try {
        setLoading(true);
        const res = await fetchAdminUsers({
          page: 1,
          limit: 50,
          sortBy,
          sortOrder,
          search: searchTerm,
        });
        if (cancelled) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        // Normalize IDs for React keys (fallback to wallet)
        const normalized = data.map((u, idx) => ({ id: u.wallet || idx + 1, ...u }));
        setUsers(normalized);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load admin users', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUsers();
    const interval = setInterval(loadUsers, 300_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async (silent = false) => {
      try {
        if (!silent) {
          setStatsLoading(true);
          setStatsError(null);
        }
        const { params, meta } = buildPeriodRequest(statsPeriod);
        setStatsMeta(meta);
        const data = await fetchStatsOverview(params);
        if (cancelled) return;

        setStats(data);
        setStatsMeta((prev) => ({
          ...prev,
          rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prev.rangeLabel,
          bucketMinutes: data?.bucket?.minutes ?? prev.bucketMinutes,
        }));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load user metrics", err);
        setStatsError("Failed to load user metrics");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    loadStats(false);
    const interval = setInterval(() => loadStats(true), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statsPeriod]);

  // Load admin extras: top users (sent/received for current statsPeriod), relay usage, recent logins
  useEffect(() => {
    let cancelled = false;
    const loadExtras = async () => {
      try {
        setExtrasLoading(true);
        const [topS, topR, relay, recents] = await Promise.all([
          fetchTopUsers({ metric: 'sent', period: statsPeriod, limit: 10 }),
          fetchTopUsers({ metric: 'received', period: statsPeriod, limit: 10 }),
          fetchRelayUsage({ sortBy: 'ratio', sortOrder: 'desc', limit: 10 }),
          fetchRecentLogins({ limit: 10 }),
        ]);
        if (cancelled) return;
        setTopSent(Array.isArray(topS?.data) ? topS.data : []);
        setTopReceived(Array.isArray(topR?.data) ? topR.data : []);
        setRelayUsage(Array.isArray(relay?.data) ? relay.data : []);
        setRecentLogins(Array.isArray(recents?.data) ? recents.data : []);
      } catch (err) {
        if (!cancelled) console.error('Failed to load admin extra stats', err);
      } finally {
        if (!cancelled) setExtrasLoading(false);
      }
    };
    loadExtras();
    const interval = setInterval(loadExtras, 180_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [statsPeriod]);

  useEffect(() => {
    let cancelled = false;
    const resolveWindowDays = (periodKey) => {
      if (periodKey === "1h" || periodKey === "1d") return 1;
      if (periodKey === "7d") return 7;
      return 14;
    };

    const loadAdoption = async () => {
      try {
        setAdoptionLoading(true);
        setAdoptionError(null);
        const windowDays = resolveWindowDays(statsPeriod);
        const [overviewRes, funnelRes] = await Promise.all([
          fetchAdoptionOverview({ period: statsPeriod }),
          fetchAdoptionFunnel({ period: statsPeriod, windowDays }),
        ]);
        if (cancelled) return;
        setAdoptionOverview(overviewRes);
        setAdoptionFunnel(funnelRes);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load adoption metrics", err);
          setAdoptionError("Failed to load adoption metrics");
        }
      } finally {
        if (!cancelled) setAdoptionLoading(false);
      }
    };

    loadAdoption();
    const interval = setInterval(loadAdoption, 240_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [statsPeriod]);

  useEffect(() => {
    let cancelled = false;
    const loadActionsInsights = async () => {
      try {
        setActionsLoading(true);
        setActionsError(null);
        const data = await fetchActionsOverview({ period: statsPeriod, limit: 8 });
        if (!cancelled) {
          setActionsInsights(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load actions insights", error);
          setActionsError("No se pudieron cargar las métricas de Actions");
        }
      } finally {
        if (!cancelled) setActionsLoading(false);
      }
    };

    loadActionsInsights();
    const interval = setInterval(loadActionsInsights, 180_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [statsPeriod]);

  useEffect(() => {
    let cancelled = false;

    const loadCapacity = async () => {
      try {
        setCapacityLoading(true);
        setCapacityError(null);
        const data = await fetchRelayCapacity({ limit: 8 });
        if (!cancelled) setRelayCapacity(data);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load relay capacity", error);
          setCapacityError("No se pudo cargar la capacidad de relay");
        }
      } finally {
        if (!cancelled) setCapacityLoading(false);
      }
    };

    loadCapacity();
    const interval = setInterval(loadCapacity, 300_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.nickname.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    list.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === "registeredAt" || sortBy === "lastLogin") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else {
        const parse = (val) =>
          typeof val === "number" && Number.isFinite(val)
            ? val
            : Number.isFinite(Number(val))
              ? Number(val)
              : 0;
        aValue = parse(aValue);
        bValue = parse(bValue);
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
    return list;
  }, [filteredUsers, sortBy, sortOrder]);

  const statsConnections = stats?.connections ?? {};
  const statsMessages = stats?.messages ?? { total: 0, history: [] };
  const product = stats?.productInsights ?? {
    tokens: { total: 0, last24h: 0 },
    blinks: { executes24h: 0, successRate24h: null },
    naturalCommands: { executed24h: 0, failed24h: 0 },
    messaging: { dmStarted24h: 0, dmAccepted24h: 0 },
  };
  const adoptionUsers = adoptionOverview?.users ?? { dau: 0, wau: 0, mau: 0, new: 0, total: 0 };
  const activationA = adoptionFunnel?.activationA ?? null;
  const activationB = adoptionFunnel?.activationB ?? null;
  const wauMauRatio =
    adoptionUsers?.mau > 0 ? Number(((adoptionUsers.wau / adoptionUsers.mau) * 100).toFixed(2)) : null;
  const uniqueParticipants = statsConnections.uniqueParticipants ?? 0;
  const newParticipants = statsConnections.newParticipants ?? 0;
  const returningParticipants =
    statsConnections.returningParticipants ??
    Math.max(0, uniqueParticipants - newParticipants);
  const returningRate =
    statsConnections.returningRate ??
    (uniqueParticipants > 0
      ? Number(((returningParticipants / uniqueParticipants) * 100).toFixed(2))
      : null);
  const statsBucketLabel = formatBucketDuration(stats?.bucket?.minutes ?? statsMeta.bucketMinutes);
  const statsRangeLabel =
    statsMeta.rangeLabel || formatRangeLabel(stats?.period?.start, stats?.period?.end) || "";
  const capacityTotals = relayCapacity?.totals ?? null;
  const capacityHotspots = relayCapacity?.hotspots ?? [];
  const actionsSend = actionsInsights?.send ?? {};
  const actionsRequest = actionsInsights?.request ?? {};
  const actionsBuy = actionsInsights?.buy ?? {};
  const actionsAgreement = actionsInsights?.agreement ?? {};
  const actionsRangeLabel = actionsInsights?.range
    ? formatRangeLabel(actionsInsights.range.from, actionsInsights.range.to)
    : statsRangeLabel;
  const actionsTopSendUsers = actionsSend.topUsers ?? [];
  const actionsSendTokens = actionsSend.tokens ?? [];
  const actionsTopRequestUsers = actionsRequest.topUsers ?? [];
  const actionsTopBuyUsers = actionsBuy.topUsers ?? [];
  const actionsBuyTokens = actionsBuy.tokens ?? [];
  const actionsAgreementCreators = actionsAgreement.topCreators ?? [];
  const actionsAgreementSigners = actionsAgreement.topSigners ?? [];
  const actionsAgreementSettlements = actionsAgreement.settlements ?? [];
  const hasAnyActionInsight =
    actionsTopSendUsers.length > 0 ||
    actionsSendTokens.length > 0 ||
    actionsTopRequestUsers.length > 0 ||
    actionsTopBuyUsers.length > 0 ||
    actionsBuyTokens.length > 0 ||
    actionsAgreementCreators.length > 0 ||
    actionsAgreementSigners.length > 0 ||
    actionsAgreementSettlements.length > 0;
  const globalUsagePct = capacityTotals ? capacityTotals.globalRatio * 100 : 0;
  const warningPct = capacityTotals ? capacityTotals.warningThreshold * 100 : 80;
  const criticalPct = capacityTotals ? capacityTotals.criticalThreshold * 100 : 95;
  const capacityLevel = capacityTotals
    ? globalUsagePct >= criticalPct
      ? "critical"
      : globalUsagePct >= warningPct
      ? "warning"
      : "normal"
    : "normal";
  const capacityAccent =
    capacityLevel === "critical" ? "#f87171" : capacityLevel === "warning" ? "#fbbf24" : "#22c55e";
  const formattedGlobalUsage = capacityTotals ? `${globalUsagePct.toFixed(1)}%` : "—";
  const capacityNotice =
    capacityLevel === "critical"
      ? "La capacidad global de relay está en nivel crítico. Revisa los buzones destacados."
      : capacityLevel === "warning"
      ? "La capacidad global de relay está en nivel de aviso. Considera purgar o ampliar cuotas."
      : null;

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatBytes = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  const getQuotaPercentage = (used, total) => ((used / total) * 100).toFixed(1);
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
  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const shortenWallet = (wallet) =>
    wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "—";
  const renderUserLabel = (item) => {
    if (!item || !item.wallet) return "—";
    if (item.nickname) return `${item.nickname} (${shortenWallet(item.wallet)})`;
    return shortenWallet(item.wallet);
  };

  const formatCount = (value) => Number(value ?? 0).toLocaleString("en-US");
  const formatPct = (value) => (value != null ? `${Number(value).toFixed(2)}%` : "—");
  const formatMsDuration = (ms) => {
    if (!ms || ms <= 0) return "—";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  };

  return (
    <div className="users-panel">
      <div className="users-panel__header">
        <div>
          <h2>Users & Activity</h2>
          <p>Seguimiento de adopción, roles y uso de relay.</p>
        </div>
        <div className="users-filters">
          <input
            type="search"
            placeholder="Buscar wallet / nickname"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <section className="users-stats">
        <div className="users-stats__header">
          <div>
            <h3>Activity summary</h3>
            <span className="range">{statsRangeLabel}</span>
          </div>
          <div className="period-selector">
            {USER_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`period-btn ${statsPeriod === option.key ? "active" : ""}`}
                onClick={() => setStatsPeriod(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div className="stats-panel__loading">
            <div className="stats-panel__spinner" />
            <p>Cargando métricas…</p>
          </div>
        ) : statsError ? (
          <div className="stats-panel__loading">
            <p>{statsError}</p>
          </div>
        ) : (
          <div className="users-stats__grid">
            <SummaryCard
              title="Uso global relay"
              value={capacityLoading && !capacityTotals ? "..." : formattedGlobalUsage}
              accent={capacityAccent}
              subtitle={capacityTotals ? `${formatBytes(capacityTotals.usedBytes)} / ${formatBytes(capacityTotals.quotaBytes)}` : undefined}
            />
            <SummaryCard title="Active wallets (period)" value={uniqueParticipants} accent="#22c55e" />
            <SummaryCard title="New wallets (period)" value={newParticipants} accent="#38bdf8" />
            <SummaryCard
              title="Returning wallets"
              value={returningParticipants}
                accent="#0ea5e9"
                subtitle={returningRate != null ? formatPct(returningRate) : "—"}
              />
              <SummaryCard title="Messages (period)" value={statsMessages?.total ?? 0} accent="#6366f1" />
            <SummaryCard
              title="Avg per bucket"
              value={typeof statsMessages.avgPerBucket === 'number'
                ? statsMessages.avgPerBucket
                : (statsMessages.history?.length ? Math.round((statsMessages.total ?? 0) / statsMessages.history.length) : 0)}
              accent="#eab308"
              subtitle={statsBucketLabel}
            />
            <SummaryCard title="Tokens total" value={product.tokens.total} accent="#fbbf24" />
            <SummaryCard
              title="DAU / WAU / MAU"
              value={
                adoptionLoading && !adoptionOverview
                  ? "..."
                  : `${formatCount(adoptionUsers.dau)} / ${formatCount(adoptionUsers.wau)} / ${formatCount(adoptionUsers.mau)}`
              }
              accent="#f97316"
              subtitle={wauMauRatio != null ? `WAU/MAU ${wauMauRatio}%` : undefined}
            />
            <SummaryCard
              title="Activation A"
              value={
                adoptionLoading && !adoptionFunnel
                  ? "..."
                  : activationA
                  ? formatPct(activationA.conversionPct)
                  : "—"
              }
              accent="#10b981"
              subtitle={
                activationA
                  ? `p50 ${formatMsDuration(activationA.ttaP50ms)}, p95 ${formatMsDuration(activationA.ttaP95ms)}`
                  : undefined
              }
            />
            <SummaryCard
              title="Activation B"
              value={
                adoptionLoading && !adoptionFunnel
                  ? "..."
                  : activationB
                  ? formatPct(activationB.conversionPct)
                  : "—"
              }
              accent="#14b8a6"
              subtitle={
                activationB
                  ? `p50 ${formatMsDuration(activationB.ttaP50ms)}, p95 ${formatMsDuration(activationB.ttaP95ms)}`
                  : undefined
              }
            />
            <SummaryCard title="Commands executed 24h" value={product.naturalCommands.executed24h} accent="#10b981" />
            <SummaryCard title="DM started 24h" value={product.messaging.dmStarted24h} accent="#f472b6" />
              <SummaryCard
                title="Relay msgs 24h"
                value={product.messaging.relayMessages24h ?? 0}
                accent="#8b5cf6"
              />
            </div>
          )}
          {capacityError && (
            <p className="users-stats__notice users-stats__notice--error">{capacityError}</p>
          )}
          {!capacityError && capacityNotice && (
            <p className={`users-stats__notice users-stats__notice--${capacityLevel}`}>{capacityNotice}</p>
          )}
          {!capacityLoading && capacityHotspots.length > 0 && (
            <div className="relay-hotspots">
              <div className="relay-hotspots__header">
                <h4>Buzones con más uso</h4>
                <span>
                  {capacityTotals?.users ? `${capacityHotspots.length}/${capacityTotals.users} usuarios` : `${capacityHotspots.length} usuarios`}
                </span>
              </div>
              <div className="relay-hotspots__list">
                {capacityHotspots.map((item) => (
                  <div key={`hotspot-${item.wallet}`} className={`relay-hotspots__item relay-hotspots__item--${item.level}`}>
                    <div className="relay-hotspots__meta">
                      <span className="relay-hotspots__wallet">{item.nickname || item.wallet}</span>
                      <span className="relay-hotspots__ratio">{(item.ratio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="relay-hotspots__details">
                      <span>{formatBytes(item.usedBytes)}</span>
                      <span className="sep">/</span>
                      <span>{formatBytes(item.quotaBytes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {adoptionError && (
            <p className="users-stats__notice">{adoptionError}</p>
          )}
        </section>

      <section className="users-extras">
        <div className="users-extras__grid">
          <div className="panel-card">
            <div className="panel-heading">
              <h3 className="panel-title">Top users (messages in period)</h3>
              <span className="panel-subtitle">{statsRangeLabel || statsBucketLabel}</span>
            </div>
            {extrasLoading && !topSent.length && !topReceived.length ? (
              <div className="stats-panel__loading"><div className="stats-panel__spinner" /><p>Cargando…</p></div>
            ) : (
              <div className="top-users">
                <div className="top-users__col">
                  <h4>Sent</h4>
                  <ol>
                    {topSent.map((u) => (
                      <li key={`sent-${u.wallet}`}>
                        <span className="user">{u.nickname || u.wallet}</span>
                        <span className="count">{u.count.toLocaleString('en-US')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="top-users__col">
                  <h4>Received</h4>
                  <ol>
                    {topReceived.map((u) => (
                      <li key={`recv-${u.wallet}`}>
                        <span className="user">{u.nickname || u.wallet}</span>
                        <span className="count">{u.count.toLocaleString('en-US')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <h3 className="panel-title">Relay usage (top)</h3>
              <span className="panel-subtitle">by usage ratio</span>
            </div>
            {extrasLoading && !relayUsage.length ? (
              <div className="stats-panel__loading"><div className="stats-panel__spinner" /><p>Cargando…</p></div>
            ) : (
              <div className="users-table__wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Used</th>
                      <th>Quota</th>
                      <th>Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relayUsage.map((u) => (
                      <tr key={`relay-${u.wallet}`}>
                        <td>{u.nickname || u.wallet}</td>
                        <td>{formatBytes(u.relayUsedBytes)}</td>
                        <td>{formatBytes(u.relayQuotaBytes)}</td>
                        <td>{((u.ratio ?? 0) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <h3 className="panel-title">Recent logins</h3>
              <span className="panel-subtitle">latest {recentLogins.length}</span>
            </div>
            {extrasLoading && !recentLogins.length ? (
              <div className="stats-panel__loading"><div className="stats-panel__spinner" /><p>Cargando…</p></div>
            ) : (
              <ul className="recent-logins">
                {recentLogins.map((u) => (
                  <li key={`login-${u.wallet}`}>
                    <span className="user">{u.nickname || u.wallet}</span>
                    <span className="date">{formatDate(u.lastLogin)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="users-actions">
        <div className="users-actions__header">
          <div>
            <h3>Top Solana Actions</h3>
            <span className="users-actions__subtitle">{actionsRangeLabel}</span>
          </div>
          {actionsError ? (
            <span className="users-actions__status error">{actionsError}</span>
          ) : actionsLoading && !actionsInsights ? (
            <span className="users-actions__status">Cargando…</span>
          ) : null}
        </div>
        <div className="users-actions__summary">
          <SummaryCard
            title="Send (period)"
            value={actionsSend.periodCount ?? 0}
            accent="#3b82f6"
            subtitle={`Volumen ${formatAmount(actionsSend.periodVolume)} · Total ${formatNumber(actionsSend.lifetimeTotal)}`}
          />
          <SummaryCard
            title="Requests (period)"
            value={actionsRequest.periodCount ?? 0}
            accent="#f59e0b"
            subtitle={`Importe ${formatAmount(actionsRequest.periodAmount)} · Total ${formatNumber(actionsRequest.lifetimeTotal)}`}
          />
          <SummaryCard
            title="Buy (period)"
            value={actionsBuy.periodCount ?? 0}
            accent="#10b981"
            subtitle={`Volumen ${formatAmount(actionsBuy.periodVolume)} · Total ${formatNumber(actionsBuy.lifetimeTotal)}`}
          />
          <SummaryCard
            title="Agreements (period)"
            value={actionsAgreement.periodCreated ?? 0}
            accent="#8b5cf6"
            subtitle={`Firmados ${formatNumber(actionsAgreement.periodSigned)} · Settled ${formatNumber(actionsAgreement.periodSettled)}`}
          />
        </div>
        <div className="users-actions__grid">
          {actionsTopSendUsers.length > 0 && (
            <ActionTable
              title="Send · Top usuarios"
              columns={["Usuario", "Envíos", "Volumen", "Promedio", "Tokens", "Último"]}
              rows={actionsTopSendUsers.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                formatAmount(item.totalAmount),
                item.avgAmount != null ? formatAmount(item.avgAmount) : "—",
                item.tokens?.length ? item.tokens.join(", ") : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          )}
          {actionsSendTokens.length > 0 && (
            <ActionTable
              title="Send · Tokens"
              columns={["Token", "Envíos", "Volumen"]}
              rows={actionsSendTokens.map((token) => [
                token.token || "—",
                formatNumber(token.count),
                formatAmount(token.totalAmount),
              ])}
            />
          )}
          {actionsTopRequestUsers.length > 0 && (
            <ActionTable
              title="Requests · Top usuarios"
              columns={["Usuario", "Solicitudes", "Importe", "Promedio", "Tokens", "Último"]}
              rows={actionsTopRequestUsers.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                formatAmount(item.totalAmount),
                item.avgAmount != null ? formatAmount(item.avgAmount) : "—",
                item.tokens?.length ? item.tokens.join(", ") : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          )}
          {actionsTopBuyUsers.length > 0 && (
            <ActionTable
              title="Buy · Top usuarios"
              columns={["Usuario", "Compras", "Volumen token", "Importe SOL", "Tokens", "Último"]}
              rows={actionsTopBuyUsers.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                formatAmount(item.totalVolume),
                formatAmount(item.totalAmountSol),
                item.tokens?.length ? item.tokens.join(", ") : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          )}
          {actionsBuyTokens.length > 0 && (
            <ActionTable
              title="Buy · Tokens"
              columns={["Token", "Compras", "Volumen"]}
              rows={actionsBuyTokens.map((token) => [
                token.token || "—",
                formatNumber(token.count),
                formatAmount(token.totalVolume),
              ])}
            />
          )}
          {actionsAgreementCreators.length > 0 && (
            <ActionTable
              title="Agreements · Creadores"
              columns={["Usuario", "Creó", "Contrapartes", "Último"]}
              rows={actionsAgreementCreators.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                item.counterparts?.length
                  ? item.counterparts.map((wallet) => shortenWallet(wallet)).join(", ")
                  : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          )}
          {actionsAgreementSigners.length > 0 && (
            <ActionTable
              title="Agreements · Firmantes"
              columns={["Usuario", "Firmó", "Etapas", "Último"]}
              rows={actionsAgreementSigners.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                item.stages?.length ? item.stages.join(", ") : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          )}
          {actionsAgreementSettlements.length > 0 && (
            <ActionTable
              title="Agreements · Liquidaciones"
              columns={["Usuario", "Liquidó", "Último"]}
              rows={actionsAgreementSettlements.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                formatDateTime(item.lastAt),
              ])}
            />
          )}
        </div>
        {!actionsLoading && !actionsError && !hasAnyActionInsight && (
          <span className="users-actions__status">Sin actividad registrada en el periodo seleccionado.</span>
        )}
      </section>

      <section className="users-table">
        <div className="users-table__header">
          <h3>Users ({filteredUsers.length})</h3>
          <div className="users-sort">
            <label>
              Ordenar por
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="lastLogin">Último login</option>
                <option value="registeredAt">Registro</option>
                <option value="loginCount">Logins</option>
                <option value="messagesSent">Mensajes</option>
                <option value="actionsSend">Actions send</option>
                <option value="actionsRequests">Actions requests</option>
                <option value="actionsBuy">Actions buy</option>
                <option value="actionsAgreements">Actions agreements</option>
                <option value="tokensAdded">Tokens añadidos</option>
                <option value="blinkExecutes">Blinks ejecutados</option>
                <option value="naturalCommandsExecuted">Comandos naturales</option>
              </select>
            </label>
            <button
              type="button"
              className="sort-order"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
            <button
              type="button"
              className={`actions-toggle ${showActionMetrics ? "active" : ""}`}
              onClick={() => setShowActionMetrics((prev) => !prev)}
            >
              {showActionMetrics ? "Ocultar métricas Actions" : "Mostrar métricas Actions"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="stats-panel__loading">
            <div className="stats-panel__spinner" />
            <p>Generando tabla…</p>
          </div>
        ) : (
          <div className="users-table__wrapper">
            <table>
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>Nickname</th>
                  <th>Rol</th>
                  <th>Logins</th>
                  <th>Mensajes</th>
                  {showActionMetrics && (
                    <>
                      <th>Send</th>
                      <th>Requests</th>
                      <th>Buy</th>
                      <th>Agreements</th>
                    </>
                  )}
                  <th>Relay uso</th>
                  <th>Último login</th>
                  <th>Registro</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.wallet}</td>
                  <td>{user.nickname}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>{user.loginCount}</td>
                  <td>{user.messagesSent}</td>
                  {showActionMetrics && (
                    <>
                      <td>{formatNumber(user.actionsSend)}</td>
                      <td>{formatNumber(user.actionsRequests)}</td>
                      <td>{formatNumber(user.actionsBuy)}</td>
                      <td>{formatNumber(user.actionsAgreements)}</td>
                    </>
                  )}
                  <td>
                    <div className="relay-usage">
                      <span>
                        {formatBytes(user.relayUsedBytes)} / {formatBytes(user.relayQuotaBytes)}
                      </span>
                        <span className="quota">{getQuotaPercentage(user.relayUsedBytes, user.relayQuotaBytes)}%</span>
                      </div>
                    </td>
                    <td>{formatDate(user.lastLogin)}</td>
                    <td>{formatDate(user.registeredAt)}</td>
                    <td>
                      {user.banned ? <span className="status-badge banned">Banned</span> : <span className="status-badge active">Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, value, accent, subtitle }) {
  const displayValue =
    typeof value === "number"
      ? Number(value ?? 0).toLocaleString("en-US")
      : value ?? "—";
  return (
    <div className="users-summary-card" style={{ borderColor: accent }}>
      <span className="label">{title}</span>
      <span className="value">{displayValue}</span>
      {subtitle && <span className="subtitle">{subtitle}</span>}
    </div>
  );
}

function ActionTable({ title, columns, rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="users-actions__table">
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={`${title}-${column}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${title}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${title}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
