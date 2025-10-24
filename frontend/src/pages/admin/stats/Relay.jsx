import { useEffect, useState } from 'react';
import { fetchRelayPending, fetchRelayOverview } from '@features/stats';
import './shared.css';

const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function Relay() {
  const [pending, setPending] = useState({ data: [], totals: { count: 0, bytes: 0 } });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [p, o] = await Promise.all([
          fetchRelayPending({ limit: 20 }),
          fetchRelayOverview(),
        ]);
        if (cancelled) return;
        setPending(p);
        setOverview(o);
        setError(null);
      } catch (e) {
        if (!cancelled) setError('Failed to load relay metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const it = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(it); };
  }, []);

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

  const msgs = overview?.messages ?? [];
  const errors = overview?.errors ?? [];
  const purges = overview?.purges ?? [];

  return (
    <div className="relay-panel">
      <section className="users-stats__grid">
        <SummaryCard title="Pending messages" value={pending?.totals?.count ?? 0} accent="#8b5cf6" />
        <SummaryCard title="Pending bytes" value={formatBytes(pending?.totals?.bytes ?? 0)} accent="#7c3aed" />
        <SummaryCard title="Purged (24h)" value={purges.reduce((s, p) => s + (p.count || 0), 0)} accent="#ef4444" />
      </section>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Top pending mailboxes</h3>
          <span className="panel-subtitle">by bytes</span>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Nickname</th>
                <th>Pending</th>
                <th>Bytes</th>
                <th>Oldest</th>
              </tr>
            </thead>
            <tbody>
              {(pending?.data ?? []).map((u) => (
                <tr key={u.wallet}>
                  <td>{u.wallet}</td>
                  <td>{u.nickname || ''}</td>
                  <td>{(u.count || 0).toLocaleString('en-US')}</td>
                  <td>{formatBytes(u.bytes || 0)}</td>
                  <td>{u.oldest ? new Date(u.oldest).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Offline/online (24h)</h3>
          <span className="panel-subtitle">relay_message events</span>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Recipient online</th>
                <th>Forced</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {msgs.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.online ? 'Yes' : 'No'}</td>
                  <td>{m.forced ? 'Yes' : 'No'}</td>
                  <td>{(m.count || 0).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Relay errors (24h)</h3>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.code}>
                  <td>{e.code}</td>
                  <td>{(e.count || 0).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Purges (24h)</h3>
          <span className="panel-subtitle">ttl + manual</span>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Count</th>
                <th>Bytes</th>
              </tr>
            </thead>
            <tbody>
              {purges.map((p) => (
                <tr key={p.kind}>
                  <td>{p.kind}</td>
                  <td>{(p.count || 0).toLocaleString('en-US')}</td>
                  <td>{formatBytes(p.bytes || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, accent }) {
  return (
    <div className="users-summary-card" style={{ borderColor: accent }}>
      <span className="label">{title}</span>
      <span className="value">{typeof value === 'number' ? value.toLocaleString('en-US') : value}</span>
    </div>
  );
}

