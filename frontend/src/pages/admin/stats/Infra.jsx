import { useEffect, useMemo, useState } from 'react';
import { fetchInfraOverview } from '@features/stats';
import { PERIOD_OPTIONS, buildPeriodRequest, formatBucketDuration, formatRangeLabel } from '@features/stats';
import InfraChart from '@features/stats/components/InfraChart.jsx';
import './shared.css';

export default function Infra() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('1d');
  const [meta, setMeta] = useState(buildPeriodRequest('1d').meta);

  useEffect(() => {
    let cancelled = false;
    const load = async (silent = false) => {
      try {
        const { params, meta: m } = buildPeriodRequest(period);
        setMeta(m);
        if (!silent) setLoading(true);
        const data = await fetchInfraOverview({ ...params, bucketMinutes: m.bucketMinutes });
        if (cancelled) return;
        setOverview(data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError('Failed to load infra metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load(false);
    const it = setInterval(() => load(true), 30000);
    return () => { cancelled = true; clearInterval(it); };
  }, [period]);

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

  const bucketMinutes = overview?.bucket?.minutes ?? meta.bucketMinutes;
  const rangeLabel = formatRangeLabel(overview?.range?.from, overview?.range?.to) || meta.rangeLabel;
  const totals = overview?.totals ?? { requests: 0, errors: 0, errorRate: 0, avgLatency: 0, maxLatency: 0, p95: 0, p99: 0 };
  const topRoutes = overview?.topRoutes ?? [];
  const history = overview?.series ?? [];

  return (
    <div className="infra-panel">
      <div className="users-stats__header">
        <div>
          <h3>Infra Overview</h3>
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
        <SummaryCard title="Requests" value={totals.requests} accent="#6366f1" />
        <SummaryCard title="Errors" value={totals.errors} accent="#ef4444" />
        <SummaryCard title="Error rate" value={`${totals.errorRate?.toFixed?.(2) ?? totals.errorRate}%`} accent="#f97316" />
        <SummaryCard title="Latency p95" value={`${totals.p95} ms`} accent="#22c55e" />
        <SummaryCard title="Latency p99" value={`${totals.p99} ms`} accent="#10b981" />
        <SummaryCard title="Latency avg" value={`${totals.avgLatency} ms`} accent="#0ea5e9" />
      </section>

      <div className="panel-card panel-chart">
        <div className="panel-heading">
          <h3 className="panel-title">Requests vs Error Rate</h3>
          <span className="panel-subtitle">{formatBucketDuration(bucketMinutes)}</span>
        </div>
        <InfraChart data={history} />
      </div>

      <div className="panel-card panel-table">
        <div className="panel-heading">
          <h3 className="panel-title">Top Routes</h3>
          <span className="panel-subtitle">by volume</span>
        </div>
        <div className="users-table__wrapper">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Requests</th>
                <th>Errors</th>
                <th>Error rate</th>
                <th>Avg</th>
                <th>Max</th>
                <th>P95</th>
                <th>P99</th>
              </tr>
            </thead>
            <tbody>
              {topRoutes.map((r) => (
                <tr key={r.route}>
                  <td>{r.route}</td>
                  <td>{r.count.toLocaleString('en-US')}</td>
                  <td>{r.errors.toLocaleString('en-US')}</td>
                  <td>{(r.errorRate ?? 0).toFixed(2)}%</td>
                  <td>{Math.round(r.avgLatency || 0)} ms</td>
                  <td>{Math.round(r.maxLatency || 0)} ms</td>
                  <td>{Math.round(r.p95 || 0)} ms</td>
                  <td>{Math.round(r.p99 || 0)} ms</td>
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

