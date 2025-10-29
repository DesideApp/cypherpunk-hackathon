import { useEffect, useMemo, useState } from "react";
import { fetchStatsOverview, fetchActionsOverview } from "@features/stats";
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

const formatNumber = (value) => Number(value ?? 0).toLocaleString("en-US");
const calcRate = (num, den) => {
  const numerator = Number(num ?? 0);
  const denominator = Number(den ?? 0);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
};
const formatPercent = (value) => (value != null ? `${Number(value).toFixed(2)}%` : "—");
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const shortenWallet = (wallet) =>
  wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "—";

export default function Actions() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState(null);

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

  useEffect(() => {
    let cancelled = false;

    const loadInsights = async () => {
      try {
        setInsightsLoading(true);
        setInsightsError(null);
        const data = await fetchActionsOverview({ period: "1d", limit: 10 });
        if (!cancelled) {
          setInsights(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load detailed actions insights", err);
          setInsightsError("No se pudieron cargar los insights detallados");
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    };

    loadInsights();
    const interval = setInterval(loadInsights, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const product = useMemo(() => overview?.productInsights ?? FALLBACK, [overview]);
  const tokens = product.tokens ?? FALLBACK.tokens;
  const blinks = product.blinks ?? FALLBACK.blinks;
  const natural = product.naturalCommands ?? FALLBACK.naturalCommands;
  const messaging = product.messaging ?? FALLBACK.messaging;

  const tokensLifetimeTotal = typeof insights?.tokens?.lifetimeTotal === "number"
    ? insights.tokens.lifetimeTotal
    : Number(tokens.total ?? 0);
  const tokensLast24h = typeof insights?.tokens?.last24h === "number"
    ? insights.tokens.last24h
    : Number(tokens.last24h ?? 0);
  const tokensPrevTotal = Math.max(0, tokensLifetimeTotal - tokensLast24h);
  const tokensGrowthRate24h =
    tokensPrevTotal > 0
      ? calcRate(tokensLast24h, tokensPrevTotal)
      : tokensLast24h > 0
        ? 100
        : null;

  const blinkMetadataHits24h = insights?.blinks?.metadataHits24h ?? Number(blinks.metadataHits24h ?? 0);
  const blinkExecutes24h = insights?.blinks?.executes24h ?? Number(blinks.executes24h ?? 0);
  const blinkFailures24h = insights?.blinks?.failures24h?.total ?? 0;
  const blinkVolume24h = insights?.blinks?.volume24h ?? Number(blinks.volume24h ?? 0);
  const blinkExecutesMiss24h = Math.max(0, blinkMetadataHits24h - blinkExecutes24h);
  const blinkSuccessRate24h =
    insights?.blinks?.successRate24h != null
      ? insights.blinks.successRate24h
      : calcRate(blinkExecutes24h, blinkMetadataHits24h);
  const blinkVolumeAvg24h =
    insights?.blinks?.volumeAvg24h != null
      ? insights.blinks.volumeAvg24h
      : blinkExecutes24h > 0
        ? Number((blinkVolume24h / blinkExecutes24h).toFixed(4))
        : null;

  const naturalParsed24h = insights?.natural?.parsed24h ?? Number(natural.parsed24h ?? 0);
  const naturalExecuted24h = insights?.natural?.executed24h ?? Number(natural.executed24h ?? 0);
  const naturalRejected24h = insights?.natural?.rejected24h ?? Number(natural.rejected24h ?? 0);
  const naturalFailed24h = insights?.natural?.failed24h ?? Number(natural.failed24h ?? 0);
  const naturalParsedEffective24h = Math.max(0, naturalParsed24h - naturalRejected24h);
  const naturalSuccessRate24h =
    insights?.natural?.successRate24h != null
      ? insights.natural.successRate24h
      : calcRate(naturalExecuted24h, naturalParsedEffective24h || naturalParsed24h);
  const naturalFailureRate24h =
    insights?.natural?.failureRate24h != null
      ? insights.natural.failureRate24h
      : calcRate(naturalFailed24h, naturalParsed24h);
  const naturalRejectRate24h =
    insights?.natural?.rejectRate24h != null
      ? insights.natural.rejectRate24h
      : calcRate(naturalRejected24h, naturalParsed24h);
  const tokenTopUsers = insights?.tokens?.topUsers24h ?? [];
  const tokenTopTokens = insights?.tokens?.topTokens24h ?? [];
  const blinkTopUsers = insights?.blinks?.topUsers24h ?? [];
  const blinkTopTokens = insights?.blinks?.topTokens24h ?? [];
  const blinkFailureReasons = insights?.blinks?.failures24h?.byReason ?? [];
  const naturalTopUsers = insights?.natural?.topUsers24h ?? [];
  const naturalTopActions = insights?.natural?.topActions24h ?? [];

  const dmAcceptanceRate24h = calcRate(messaging.dmAccepted24h, messaging.dmStarted24h);

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
          <p>Métricas de tokens, blinks y comandos naturales; la mensajería queda separada como telemetría auxiliar.</p>
        </div>
        {overview?.generatedAt && (
          <span className="actions-panel__updated">
            Actualizado {new Date(overview.generatedAt).toLocaleString()}
          </span>
        )}
      </header>

      <section className="actions-highlight">
        <HighlightCard
          title="Tokens añadidos 24h"
          value={formatNumber(tokensLast24h)}
          icon="🪙"
          subtitle={`Total histórico: ${formatNumber(tokensLifetimeTotal)}`}
        />
        <HighlightCard
          title="Blink success 24h"
          value={formatPercent(blinkSuccessRate24h)}
          icon="⚡"
          subtitle={`${formatNumber(blinkExecutes24h)} / ${formatNumber(blinkMetadataHits24h)} executes`}
        />
        <HighlightCard
          title="Blink volumen 24h"
          value={`${formatNumber(blinkVolume24h)} SOL`}
          icon="💰"
          subtitle={blinkVolumeAvg24h != null ? `Avg ${blinkVolumeAvg24h} SOL por ejecución` : "Sin ejecuciones registradas"}
        />
        <HighlightCard
          title="Natural commands success 24h"
          value={formatPercent(naturalSuccessRate24h)}
          icon="🤖"
          subtitle={`${formatNumber(naturalExecuted24h)} éxitos`}
        />
        <HighlightCard
          title="Natural commands failures 24h"
          value={formatPercent(naturalFailureRate24h)}
          icon="⚠️"
          subtitle={`${formatNumber(naturalFailed24h)} fallos`}
        />
      </section>

      {insightsLoading && !insights && (
        <p className="actions-subtle">Procesando insights detallados…</p>
      )}
      {insightsError && (
        <p className="actions-error">{insightsError}</p>
      )}

      <section className="actions-section">
        <h3>Tokens</h3>
        <div className="actions-grid">
          <ActionCard label="Total añadidos" value={tokensLifetimeTotal} icon="🪙" />
          <ActionCard label="Añadidos 24h" value={tokensLast24h} icon="⚡" />
          <ActionCard
            label="Crecimiento 24h"
            value={formatPercent(tokensGrowthRate24h)}
            icon="📈"
          />
        </div>
        {tokenTopUsers.length > 0 || tokenTopTokens.length > 0 ? (
          <div className="actions-detail">
            {tokenTopUsers.length > 0 && (
              <div className="actions-table">
                <h4>Top wallets (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Tokens añadidos</th>
                      <th>Último</th>
                      <th>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenTopUsers.map((item) => (
                      <tr key={`token-user-${item.wallet}`}>
                        <td>{renderUserLabel(item)}</td>
                        <td>{formatNumber(item.count)}</td>
                        <td>{formatDateTime(item.lastAt)}</td>
                        <td>{item.tokens?.length ? item.tokens.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tokenTopTokens.length > 0 && (
              <div className="actions-table">
                <h4>Tokens más añadidos (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Mint</th>
                      <th>Altas</th>
                      <th>Usuarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenTopTokens.map((token) => (
                      <tr key={`token-code-${token.code || token.mint || 'unknown'}`}>
                        <td>{token.code || '—'}</td>
                        <td>{token.mint || '—'}</td>
                        <td>{formatNumber(token.count)}</td>
                        <td>{formatNumber(token.uniqueUsers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="actions-section">
        <h3>Blinks</h3>
        <div className="actions-grid">
          <ActionCard label="Metadata hits" value={blinks.metadataHits} icon="🛰️" />
          <ActionCard label="Hits 24h" value={blinkMetadataHits24h} icon="〽️" />
          <ActionCard label="Executes" value={blinks.executes} icon="🚀" />
          <ActionCard label="Executes 24h" value={blinkExecutes24h} icon="⚡" />
          <ActionCard label="Executes perdidos 24h" value={blinkExecutesMiss24h} icon="⏳" />
          <ActionCard label="Success rate total" value={formatPercent(calcRate(blinks.executes, blinks.metadataHits))} icon="✅" />
          <ActionCard label="Success rate 24h" value={formatPercent(blinkSuccessRate24h)} icon="✅" />
          <ActionCard label="Volumen total" value={blinks.volumeTotal} suffix="SOL" icon="💰" />
          <ActionCard label="Volumen 24h" value={blinkVolume24h} suffix="SOL" icon="⏱️" />
          <ActionCard
            label="Volumen medio 24h"
            value={blinkVolumeAvg24h != null ? blinkVolumeAvg24h : "—"}
            suffix="SOL"
            icon="📏"
          />
        </div>
        {blinkTopUsers.length > 0 || blinkTopTokens.length > 0 || blinkFailureReasons.length > 0 ? (
          <div className="actions-detail">
            {blinkTopUsers.length > 0 && (
              <div className="actions-table">
                <h4>Usuarios (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Hits</th>
                      <th>Exec</th>
                      <th>Éxito</th>
                      <th>Fallos</th>
                      <th>Volumen (SOL)</th>
                      <th>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blinkTopUsers.map((item) => (
                      <tr key={`blink-user-${item.wallet}`}>
                        <td>{renderUserLabel(item)}</td>
                        <td>{formatNumber(item.metadataHits)}</td>
                        <td>{formatNumber(item.executes)}</td>
                        <td>{formatPercent(item.successRate)}</td>
                        <td>{formatPercent(item.failureRate)}</td>
                        <td>{formatNumber(item.volume)}</td>
                        <td>{item.tokens?.length ? item.tokens.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {blinkTopTokens.length > 0 && (
              <div className="actions-table">
                <h4>Tokens (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Hits</th>
                      <th>Exec</th>
                      <th>Éxito</th>
                      <th>Volumen (SOL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blinkTopTokens.map((token) => (
                      <tr key={`blink-token-${token.token || 'unknown'}`}>
                        <td>{token.token || '—'}</td>
                        <td>{formatNumber(token.metadataHits)}</td>
                        <td>{formatNumber(token.executes)}</td>
                        <td>{formatPercent(token.successRate)}</td>
                        <td>{formatNumber(token.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {blinkFailureReasons.length > 0 && (
              <div className="actions-table">
                <h4>Fallas frecuentes (24h · {formatNumber(blinkFailures24h)})</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Motivo</th>
                      <th>Recuentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blinkFailureReasons.map((item, index) => (
                      <tr key={`blink-failure-${item.reason || index}`}>
                        <td>{item.reason || 'unknown'}</td>
                        <td>{formatNumber(item.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="actions-section">
        <h3>Comandos naturales</h3>
        <div className="actions-grid">
          <ActionCard label="Parsed" value={natural.parsed} icon="🧠" />
          <ActionCard label="Executed" value={natural.executed} icon="🤖" />
          <ActionCard label="Rejected" value={natural.rejected} icon="⛔" />
          <ActionCard label="Failed" value={natural.failed} icon="⚠️" />
          <ActionCard label="Parsed 24h" value={naturalParsed24h} icon="📥" />
          <ActionCard label="Executed 24h" value={naturalExecuted24h} icon="✅" />
          <ActionCard label="Rejected 24h" value={naturalRejected24h} icon="🚫" />
          <ActionCard label="Failed 24h" value={naturalFailed24h} icon="🔥" />
          <ActionCard label="Success rate 24h" value={formatPercent(naturalSuccessRate24h)} icon="📈" />
          <ActionCard label="Failure rate 24h" value={formatPercent(naturalFailureRate24h)} icon="📉" />
          <ActionCard label="Reject rate 24h" value={formatPercent(naturalRejectRate24h)} icon="⛔" />
        </div>
        {naturalTopUsers.length > 0 || naturalTopActions.length > 0 ? (
          <div className="actions-detail">
            {naturalTopUsers.length > 0 && (
              <div className="actions-table">
                <h4>Usuarios (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Parsed</th>
                      <th>Exec</th>
                      <th>Rechazados</th>
                      <th>Fallos</th>
                      <th>Éxito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {naturalTopUsers.map((item) => (
                      <tr key={`natural-user-${item.wallet}`}>
                        <td>{renderUserLabel(item)}</td>
                        <td>{formatNumber(item.parsed)}</td>
                        <td>{formatNumber(item.executed)}</td>
                        <td>{formatNumber(item.rejected)}</td>
                        <td>{formatNumber(item.failed)}</td>
                        <td>{formatPercent(item.successRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {naturalTopActions.length > 0 && (
              <div className="actions-table">
                <h4>Acciones (24h)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Parsed</th>
                      <th>Exec</th>
                      <th>Rechazados</th>
                      <th>Fallos</th>
                      <th>Éxito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {naturalTopActions.map((action) => (
                      <tr key={`natural-action-${action.action}`}>
                        <td>{action.action || '—'}</td>
                        <td>{formatNumber(action.parsed)}</td>
                        <td>{formatNumber(action.executed)}</td>
                        <td>{formatNumber(action.rejected)}</td>
                        <td>{formatNumber(action.failed)}</td>
                        <td>{formatPercent(action.successRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="actions-section actions-section--aux">
        <h3>Mensajería directa & relay (telemetría)</h3>
        <div className="actions-grid">
          <ActionCard label="DM iniciados" value={messaging.dmStarted} icon="💬" />
          <ActionCard label="DM aceptados" value={messaging.dmAccepted} icon="🤝" />
          <ActionCard label="Relay msgs" value={messaging.relayMessages} icon="📡" />
          <ActionCard label="DM iniciados 24h" value={messaging.dmStarted24h} icon="⚡" />
          <ActionCard label="DM aceptados 24h" value={messaging.dmAccepted24h} icon="🎯" />
          <ActionCard label="Relay msgs 24h" value={messaging.relayMessages24h} icon="📨" />
          <ActionCard
            label="DM acceptance 24h"
            value={formatPercent(dmAcceptanceRate24h)}
            icon="📊"
            subtitle={`${formatNumber(messaging.dmAccepted24h)} / ${formatNumber(messaging.dmStarted24h)}`}
          />
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

function ActionCard({ label, value, icon, suffix, subtitle }) {
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
        {subtitle && <span className="action-card__subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

function HighlightCard({ title, value, icon, subtitle }) {
  return (
    <div className="actions-highlight__card">
      <div className="actions-highlight__meta">
        <span className="actions-highlight__icon">{icon}</span>
        <span className="actions-highlight__title">{title}</span>
      </div>
      <span className="actions-highlight__value">{value}</span>
      <span className="actions-highlight__subtitle">{subtitle}</span>
    </div>
  );
}
  const renderUserLabel = (item) => {
    if (!item) return "—";
    if (item.nickname) {
      return `${item.nickname} (${shortenWallet(item.wallet)})`;
    }
    return shortenWallet(item.wallet);
  };
