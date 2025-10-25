import { useEffect, useMemo, useState } from 'react';
import { fetchAdoptionOverview, fetchAdoptionCohorts, fetchAdoptionFunnel } from '@features/stats';
import { PERIOD_OPTIONS, buildPeriodRequest, formatRangeLabel } from '@features/stats';
import './shared.css';

export default function Adoption() {
  const [data, setData] = useState(null);
  const [cohorts, setCohorts] = useState(null);
  const [funnel, setFunnel] = useState(null);
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
        const [res, coh, fun] = await Promise.all([
          fetchAdoptionOverview(params),
          fetchAdoptionCohorts({ weeks: 8, activity: 'messages' }),
          fetchAdoptionFunnel({ windowDays: 1, period })
        ]);
        if (cancelled) return;
        setData(res);
        setCohorts(coh);
        setFunnel(fun);
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
  const activationA = funnel?.activationA ?? { count: 0, conversionPct: 0, explicit: 0, inferred: 0, ttaP50ms: 0, ttaP95ms: 0 };
  const activationB = funnel?.activationB ?? { count: 0, conversionPct: 0, ttaP50ms: 0, ttaP95ms: 0, anyReceived: 0 };
  const funnelSteps = funnel?.funnel ?? [];

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

      <section className="users-stats__grid">
        <SummaryCard title="Activation A (24h)" value={`${(activationA.conversionPct ?? 0).toFixed ? activationA.conversionPct.toFixed(2) : activationA.conversionPct}%`} accent="#22c55e" />
        <SummaryCard title="A tta p50" value={`${Math.round(activationA.ttaP50ms / 1000)} s`} accent="#16a34a" />
        <SummaryCard title="A tta p95" value={`${Math.round(activationA.ttaP95ms / 1000)} s`} accent="#16a34a" />
        <SummaryCard title="Activation B (24h)" value={`${(activationB.conversionPct ?? 0).toFixed ? activationB.conversionPct.toFixed(2) : activationB.conversionPct}%`} accent="#0ea5e9" />
        <SummaryCard title="B tta p50" value={`${Math.round(activationB.ttaP50ms / 1000)} s`} accent="#0ea5e9" />
        <SummaryCard title="B tta p95" value={`${Math.round(activationB.ttaP95ms / 1000)} s`} accent="#0ea5e9" />
      </section>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Activation funnel (24h)</h3>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead><tr><th>Step</th><th>Count</th><th>Conversion</th></tr></thead>
            <tbody>
              {funnelSteps.map((s) => (
                <tr key={s.step}><td>{s.step}</td><td>{(s.count || 0).toLocaleString('en-US')}</td><td>{(s.pct || 0).toLocaleString('en-US')}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {cohorts?.cohorts?.length ? (
        <div className="panel-card panel-table">
          <div className="panel-heading">
            <h3 className="panel-title">Cohorts (weekly retention)</h3>
          </div>
          <div className="users-table__wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Size</th>
                  {Array.from({ length: cohorts.weeks }, (_, i) => i + 1).map((w) => (
                    <th key={`w${w}`}>W{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.cohorts.map((row) => (
                  <tr key={row.cohortStart}>
                    <td>{new Date(row.cohortStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td>{row.size}</td>
                    {row.retention.map((r) => (
                      <td key={`r${r.week}`}>{r.pct.toFixed(2)}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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
