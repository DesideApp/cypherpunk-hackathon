import { useEffect, useMemo, useState } from 'react';
import { fetchAdoptionOverview } from '@features/stats';
import { PERIOD_OPTIONS, buildPeriodRequest, formatRangeLabel } from '@features/stats';
import './shared.css';

export default function Adoption() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [meta, setMeta] = useState(buildPeriodRequest('30d').meta);

  useEffect(() => {
    let cancelled = false;
    const load = async (silent = false) => {
      try {
        const { params, meta: m } = buildPeriodRequest(period);
        setMeta(m);
        if (!silent) setLoading(true);
        const res = await fetchAdoptionOverview(params);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (e) {
        if (!cancelled) setError('Failed to load adoption metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load(false);
    const it = setInterval(() => load(true), 60000);
    return () => { cancelled = true; clearInterval(it); };
  }, [period]);

  if (loading && !data) {
    return (
      <div className="stats-panel__loading">
        <div className="stats-panel__spinner" />
        <p>Cargando métricas…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="stats-panel__loading">
        <p>{error}</p>
      </div>
    );
  }

  const rangeLabel = formatRangeLabel(data?.range?.from, data?.range?.to) || meta.rangeLabel;
  const users = data?.users ?? { total: 0, new: 0, dau: 0, wau: 0, mau: 0 };
  const dm = data?.dm ?? { started: 0, accepted: 0, acceptRate: null };
  const signups = data?.signups?.history ?? [];

  return (
    <div className="adoption-panel">
      <div className="users-stats__header">
        <div>
          <h3>Adoption & Cohorts</h3>
          <span className="range">{rangeLabel}</span>
        </div>
        <div className="period-selector">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.key} type="button" className={`period-btn ${period === opt.key ? 'active' : ''}`} onClick={() => setPeriod(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <section className="users-stats__grid">
        <SummaryCard title="Total users" value={users.total} accent="#334155" />
        <SummaryCard title="New in range" value={users.new} accent="#7c3aed" />
        <SummaryCard title="DAU" value={users.dau} accent="#22c55e" />
        <SummaryCard title="WAU" value={users.wau} accent="#0ea5e9" />
        <SummaryCard title="MAU" value={users.mau} accent="#f59e0b" />
        <SummaryCard title="DM accept rate" value={dm.acceptRate != null ? `${dm.acceptRate}%` : '—'} accent="#10b981" />
      </section>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Signups by day</h3>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Signups</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((p) => (
                <tr key={p.timestamp}>
                  <td>{new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td>{(p.value ?? 0).toLocaleString('en-US')}</td>
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

