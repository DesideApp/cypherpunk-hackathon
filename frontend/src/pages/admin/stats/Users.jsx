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
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
    return list;
  }, [filteredUsers, sortBy, sortOrder]);

  const statsConnections = stats?.connections ?? {};
  const statsMessages = stats?.messages ?? {};
  const product = stats?.productInsights ?? {
    tokens: { total: 0, last24h: 0 },
    blinks: { executes24h: 0, successRate24h: null },
    naturalCommands: { executed24h: 0, failed24h: 0 },
    messaging: { dmStarted24h: 0, dmAccepted24h: 0 },
  };
  const statsBucketLabel = formatBucketDuration(stats?.bucket?.minutes ?? statsMeta.bucketMinutes);
  const statsRangeLabel =
    statsMeta.rangeLabel || formatRangeLabel(stats?.period?.start, stats?.period?.end) || "";

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
            <SummaryCard title="Active connections" value={statsConnections.active} accent="#22c55e" />
            <SummaryCard title="New connections" value={statsConnections.newToday} accent="#38bdf8" />
            <SummaryCard title="Messages (period)" value={statsMessages.total} accent="#6366f1" />
            <SummaryCard title="Tokens total" value={product.tokens.total} accent="#fbbf24" />
            <SummaryCard title="Commands executed 24h" value={product.naturalCommands.executed24h} accent="#10b981" />
            <SummaryCard title="DM started 24h" value={product.messaging.dmStarted24h} accent="#f472b6" />
            <SummaryCard
              title="Avg per bucket"
              value={typeof statsMessages.avgPerBucket === 'number'
                ? statsMessages.avgPerBucket
                : (statsMessages.history?.length ? Math.round((statsMessages.total ?? 0) / statsMessages.history.length) : 0)}
              accent="#eab308"
              subtitle={statsBucketLabel}
            />
            <SummaryCard
              title="Relay msgs 24h"
              value={product.messaging.relayMessages24h ?? 0}
              accent="#8b5cf6"
            />
          </div>
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
              </select>
            </label>
            <button
              type="button"
              className="sort-order"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
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
  return (
    <div className="users-summary-card" style={{ borderColor: accent }}>
      <span className="label">{title}</span>
      <span className="value">{Number(value ?? 0).toLocaleString("en-US")}</span>
      {subtitle && <span className="subtitle">{subtitle}</span>}
    </div>
  );
}
