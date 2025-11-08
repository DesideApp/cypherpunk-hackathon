import { useEffect, useMemo, useState } from "react";
import { fetchJobStatuses } from "@features/stats";
import "./shared.css";
import "./Scheduler.css";

const EXPECTED_INTERVALS = {
  snapshotOverviewHourly: 60 * 60 * 1000,
  snapshotOverviewDaily: 24 * 60 * 60 * 1000,
  cleanupRelayByTier: 24 * 60 * 60 * 1000,
  cleanupAttachments: 24 * 60 * 60 * 1000,
  reconcileRelayHistory: 24 * 60 * 60 * 1000,
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function computeNextRun(status, job) {
  const interval = EXPECTED_INTERVALS[job];
  if (!interval) return null;
  const finished = status?.finishedAt || status?.startedAt;
  if (!finished) return null;
  return new Date(finished + interval).toLocaleString();
}

function normaliseHistory(history = []) {
  return history.map((entry) => ({
    ...entry,
    key: `${entry.event}-${entry.at}-${entry.status}`,
  }));
}

function buildDetailList(item) {
  if (!item) return [];
  return Object.entries(item)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(", ") : value }));
}

export default function Scheduler() {
  const [payload, setPayload] = useState({ jobs: {}, history: {}, alerts: [], metrics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchJobStatuses();
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load scheduler status", err);
          setError("No se pudo cargar el estado del scheduler");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const jobs = useMemo(() => Object.entries(payload.jobs || {}).map(([name, status]) => ({ name, ...status })), [payload.jobs]);
  const alerts = payload.alerts ?? [];
  const history = useMemo(() => {
    const entries = Object.entries(payload.history || {}).map(([name, events]) => ({
      name,
      events: normaliseHistory(events),
    }));
    return entries;
  }, [payload.history]);

  if (loading && !jobs.length) {
    return (
      <div className="stats-panel__loading">
        <div className="stats-panel__spinner" />
        <p>Cargando estado del scheduler…</p>
      </div>
    );
  }

  if (error && !jobs.length) {
    return (
      <div className="stats-panel__loading">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="scheduler-panel">
      <header className="scheduler-panel__header">
        <div>
          <h2>Scheduler overview</h2>
          <p>Estado en vivo de los cron jobs y snapshots.</p>
        </div>
        <div className="scheduler-panel__meta">
          <span>Actualizado: {formatDate(Date.now())}</span>
        </div>
      </header>

      {error && <div className="scheduler-alert scheduler-alert--error">{error}</div>}

      {alerts.length > 0 && (
        <section className="scheduler-section">
          <h3>Alertas activas</h3>
          <div className="scheduler-alerts-grid">
            {alerts.map((alert) => (
              <article key={`${alert.job}-${alert.type}-${alert.at}`} className={`scheduler-alert scheduler-alert--${alert.type}`}>
                <header>
                  <strong>{alert.job}</strong>
                  <span>{alert.type}</span>
                </header>
                <p>{alert.message}</p>
                {Array.isArray(alert.details) && alert.details.length > 0 && (
                  <p className="scheduler-alert__details">
                    Detalles: {alert.details.map((d) => new Date(d).toLocaleString()).join(" · ")}
                  </p>
                )}
                <footer>Última ejecución: {formatDate(alert.at)}</footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="scheduler-section">
        <h3>Resumen de jobs</h3>
        <div className="scheduler-jobs-grid">
          {jobs.map((job) => (
            <article key={job.name} className={`scheduler-job-card scheduler-job-card--${job.status ?? "unknown"}`}>
              <header>
                <h4>{job.name}</h4>
                <span className="scheduler-job-card__status">{job.status ?? "unknown"}</span>
              </header>
              <dl>
                <div>
                  <dt>Último inicio</dt>
                  <dd>{formatDate(job.startedAt)}</dd>
                </div>
                <div>
                  <dt>Último fin</dt>
                  <dd>{formatDate(job.finishedAt)}</dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{formatDuration(job.durationMs)}</dd>
                </div>
                <div>
                  <dt>Próximo estimado</dt>
                  <dd>{computeNextRun(job, job.name) ?? "—"}</dd>
                </div>
              </dl>
              {job.result && Object.keys(job.result).length > 0 && (
                <div className="scheduler-job-card__results">
                  {buildDetailList(job.result).map((item) => (
                    <span key={item.key}>
                      {item.key}: {typeof item.value === "number" ? item.value.toLocaleString("en-US") : String(item.value)}
                    </span>
                  ))}
                </div>
              )}
              {job.error && (
                <div className="scheduler-job-card__error">
                  <strong>Error</strong>
                  <code>{job.error}</code>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="scheduler-section">
        <h3>Historial reciente</h3>
        {history.length === 0 ? (
          <p className="scheduler-empty">No hay historial registrado todavía.</p>
        ) : (
          <div className="scheduler-history">
            {history.map((item) => (
              <article key={item.name} className="scheduler-history__item">
                <header>
                  <h4>{item.name}</h4>
                </header>
                <ul>
                  {item.events.map((event) => (
                    <li key={event.key}>
                      <div className={`scheduler-history__badge scheduler-history__badge--${event.status}`}>
                        {event.status}
                      </div>
                      <div className="scheduler-history__meta">
                        <span>{formatDate(event.finishedAt || event.at)}</span>
                        {event.durationMs != null && <span>{formatDuration(event.durationMs)}</span>}
                      </div>
                      {event.error && <code>{event.error}</code>}
                      {event.result && Object.keys(event.result).length > 0 && (
                        <div className="scheduler-history__result">
                          {buildDetailList(event.result).map((detail) => (
                            <span key={detail.key}>
                              {detail.key}: {typeof detail.value === "number" ? detail.value.toLocaleString("en-US") : String(detail.value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
