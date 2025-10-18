import { useEffect, useMemo, useState } from "react";
import { fetchStatsOverview } from "@features/stats";
import "./shared.css";
import "./Actions.css";

const FALLBACK = {
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

export default function Actions() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchStatsOverview();
        if (!cancelled) {
          setOverview(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load product actions", err);
          setError("No se pudieron cargar las métricas de acciones");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadOverview();
    const interval = setInterval(loadOverview, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const product = useMemo(() => overview?.productInsights ?? FALLBACK, [overview]);

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
    <div className="actions-panel">
      <header className="actions-panel__header">
        <div>
          <h2>Actions & Signals</h2>
          <p>Evolución de tokens, blinks, comandos naturales y mensajería directa.</p>
        </div>
        {overview?.generatedAt && (
          <span className="actions-panel__updated">
            Actualizado {new Date(overview.generatedAt).toLocaleString()}
          </span>
        )}
      </header>

      <section className="actions-section">
        <h3>Tokens</h3>
        <div className="actions-grid">
          <ActionCard label="Total añadidos" value={product.tokens.total} icon="🪙" />
          <ActionCard label="Añadidos 24h" value={product.tokens.last24h} icon="⚡" />
        </div>
      </section>

      <section className="actions-section">
        <h3>Blinks</h3>
        <div className="actions-grid">
          <ActionCard label="Metadata hits" value={product.blinks.metadataHits} icon="🛰️" />
          <ActionCard label="Hits 24h" value={product.blinks.metadataHits24h} icon="〽️" />
          <ActionCard label="Executes" value={product.blinks.executes} icon="🚀" />
          <ActionCard label="Executes 24h" value={product.blinks.executes24h} icon="⚡" />
          <ActionCard
            label="Success rate 24h"
            value={product.blinks.successRate24h != null ? `${product.blinks.successRate24h}%` : "—"}
            icon="✅"
          />
          <ActionCard label="Volumen total" value={product.blinks.volumeTotal} suffix="SOL" icon="💰" />
          <ActionCard label="Volumen 24h" value={product.blinks.volume24h} suffix="SOL" icon="⏱️" />
        </div>
      </section>

      <section className="actions-section">
        <h3>Comandos naturales</h3>
        <div className="actions-grid">
          <ActionCard label="Parsed" value={product.naturalCommands.parsed} icon="🧠" />
          <ActionCard label="Executed" value={product.naturalCommands.executed} icon="🤖" />
          <ActionCard label="Rejected" value={product.naturalCommands.rejected} icon="⛔" />
          <ActionCard label="Failed" value={product.naturalCommands.failed} icon="⚠️" />
          <ActionCard label="Parsed 24h" value={product.naturalCommands.parsed24h} icon="📥" />
          <ActionCard label="Executed 24h" value={product.naturalCommands.executed24h} icon="✅" />
          <ActionCard label="Rejected 24h" value={product.naturalCommands.rejected24h} icon="🚫" />
          <ActionCard label="Failed 24h" value={product.naturalCommands.failed24h} icon="🔥" />
        </div>
      </section>

      <section className="actions-section">
        <h3>Mensajería directa & relay</h3>
        <div className="actions-grid">
          <ActionCard label="DM iniciados" value={product.messaging.dmStarted} icon="💬" />
          <ActionCard label="DM aceptados" value={product.messaging.dmAccepted} icon="🤝" />
          <ActionCard label="Relay msgs" value={product.messaging.relayMessages} icon="📡" />
          <ActionCard label="DM iniciados 24h" value={product.messaging.dmStarted24h} icon="⚡" />
          <ActionCard label="DM aceptados 24h" value={product.messaging.dmAccepted24h} icon="🎯" />
          <ActionCard label="Relay msgs 24h" value={product.messaging.relayMessages24h} icon="📨" />
        </div>
      </section>

      <section className="actions-notes">
        <h3>Notas de instrumentación</h3>
        <ul>
          <li>Tokens se dispara desde tokens/routes/addToken.js vía <code>logEvent('token_added')</code>.</li>
          <li>Blinks registra hits y executes en los controladores de compra y metadata.</li>
          <li>Comandos naturales cubren parsed/executed/rejected/failed desde el parser nuevo.</li>
          <li>Mensajería suma DM start/accept y relay messages (RTC/Relay controllers).</li>
          <li>Todos los eventos están envueltos en <code>safeLog</code>; fallos no bloquean flujos críticos.</li>
        </ul>
      </section>
    </div>
  );
}

function ActionCard({ label, value, icon, suffix }) {
  const displayValue = typeof value === "number" ? value.toLocaleString("en-US") : value;
  return (
    <div className="action-card">
      <span className="action-card__icon">{icon}</span>
      <div className="action-card__body">
        <span className="action-card__label">{label}</span>
        <span className="action-card__value">
          {displayValue}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
    </div>
  );
}
