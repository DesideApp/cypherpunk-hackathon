import { useEffect, useMemo, useState } from "react";
import { fetchStatsOverview, fetchActionsOverview, formatRangeLabel } from "@features/stats";
import "./shared.css";
import "./Actions.css";

const ACTIONS_FALLBACK = {
  send: { total: 0, count24h: 0, volume24h: 0 },
  request: { total: 0, count24h: 0, amount24h: 0 },
  buy: { total: 0, count24h: 0, volume24h: 0, volumeTotal: 0 },
  agreement: { total: 0, created24h: 0, signed24h: 0, settled24h: 0 },
};

const MESSAGING_FALLBACK = {
  dmStarted: 0,
  dmAccepted: 0,
  relayMessages: 0,
  dmStarted24h: 0,
  dmAccepted24h: 0,
  relayMessages24h: 0,
};

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
const formatPercent = (value) =>
  value != null && Number.isFinite(value) ? `${Number(value).toFixed(2)}%` : "—";
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
const shortenWallet = (wallet) => (wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "—");
const renderUserLabel = (item) => {
  if (!item || !item.wallet) return "—";
  if (item.nickname) return `${item.nickname} (${shortenWallet(item.wallet)})`;
  return shortenWallet(item.wallet);
};
const calcRate = (num, den) => {
  const numerator = Number(num ?? 0);
  const denominator = Number(den ?? 0);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

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

  const product = useMemo(() => overview?.productInsights ?? {}, [overview]);
  const actions = product.actions ?? ACTIONS_FALLBACK;
  const messaging = product.messaging ?? MESSAGING_FALLBACK;

  const sendInsights = insights?.send ?? {
    lifetimeTotal: 0,
    periodCount: 0,
    periodVolume: 0,
    topUsers: [],
    tokens: [],
  };
  const requestInsights = insights?.request ?? {
    lifetimeTotal: 0,
    periodCount: 0,
    periodAmount: 0,
    topUsers: [],
  };
  const buyInsights = insights?.buy ?? {
    lifetimeTotal: 0,
    periodCount: 0,
    periodVolume: 0,
    topUsers: [],
    tokens: [],
  };
  const agreementInsights = insights?.agreement ?? {
    lifetimeTotal: 0,
    periodCreated: 0,
    periodSigned: 0,
    periodSettled: 0,
    topCreators: [],
    topSigners: [],
    settlements: [],
  };

  const insightsRangeLabel = insights?.range
    ? formatRangeLabel(insights.range.from, insights.range.to)
    : null;

  const sendAvgPeriod =
    sendInsights.periodCount > 0
      ? sendInsights.periodVolume / sendInsights.periodCount
      : null;
  const requestAvgPeriod =
    requestInsights.periodCount > 0
      ? requestInsights.periodAmount / requestInsights.periodCount
      : null;
  const buyAvgPeriod =
    buyInsights.periodCount > 0 ? buyInsights.periodVolume / buyInsights.periodCount : null;
  const agreementClosureRate = calcRate(
    agreementInsights.periodSettled,
    agreementInsights.periodCreated
  );

  const dmAcceptanceRate24h = calcRate(messaging.dmAccepted24h, messaging.dmStarted24h);

  const hasAnyInsights =
    (sendInsights.topUsers?.length ?? 0) > 0 ||
    (sendInsights.tokens?.length ?? 0) > 0 ||
    (requestInsights.topUsers?.length ?? 0) > 0 ||
    (buyInsights.topUsers?.length ?? 0) > 0 ||
    (buyInsights.tokens?.length ?? 0) > 0 ||
    (agreementInsights.topCreators?.length ?? 0) > 0 ||
    (agreementInsights.topSigners?.length ?? 0) > 0 ||
    (agreementInsights.settlements?.length ?? 0) > 0;

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
          <h2>Solana Actions</h2>
          <p>
            Seguimiento end-to-end de envíos, requests, compras y agreements: volumen,
            éxito por wallet y tokens destacados. La mensajería queda como telemetría auxiliar.
          </p>
        </div>
        {overview?.generatedAt && (
          <span className="actions-panel__updated">
            Actualizado {new Date(overview.generatedAt).toLocaleString()}
          </span>
        )}
      </header>

      <section className="actions-highlight">
        <HighlightCard
          title="Send 24h"
          value={formatNumber(actions.send.count24h)}
          icon="✉️"
          subtitle={`Volumen ${formatAmount(actions.send.volume24h)} · Total ${formatNumber(actions.send.total)}`}
        />
        <HighlightCard
          title="Requests 24h"
          value={formatNumber(actions.request.count24h)}
          icon="🧾"
          subtitle={`Importe ${formatAmount(actions.request.amount24h)} · Total ${formatNumber(actions.request.total)}`}
        />
        <HighlightCard
          title="Buy 24h"
          value={formatNumber(actions.buy.count24h)}
          icon="🛒"
          subtitle={`Volumen ${formatAmount(actions.buy.volume24h)} · Total ${formatNumber(actions.buy.total)}`}
        />
        <HighlightCard
          title="Agreements 24h"
          value={formatNumber(actions.agreement.created24h)}
          icon="🤝"
          subtitle={`Firmados ${formatNumber(actions.agreement.signed24h)} · Settled ${formatNumber(actions.agreement.settled24h)}`}
        />
      </section>

      {insightsRangeLabel && (
        <p className="actions-subtle">Detalle generado para {insightsRangeLabel}</p>
      )}
      {insightsLoading && !insights && (
        <p className="actions-subtle">Procesando insights detallados…</p>
      )}
      {insightsError && <p className="actions-error">{insightsError}</p>}
      {!insightsLoading && !insightsError && !hasAnyInsights && (
        <p className="actions-subtle">Sin actividad registrada en el periodo seleccionado.</p>
      )}

      <section className="actions-section">
        <h3>Send</h3>
        <div className="actions-grid">
          <ActionCard label="Total histórico" value={formatNumber(sendInsights.lifetimeTotal)} icon="♾️" />
          <ActionCard label="Envíos periodo" value={formatNumber(sendInsights.periodCount)} icon="✉️" />
          <ActionCard label="Volumen periodo" value={formatAmount(sendInsights.periodVolume)} icon="💸" />
          <ActionCard
            label="Promedio periodo"
            value={sendAvgPeriod != null ? formatAmount(sendAvgPeriod) : "—"}
            icon="📊"
          />
        </div>
        {(sendInsights.topUsers.length > 0 || sendInsights.tokens.length > 0) && (
          <div className="actions-detail">
            {sendInsights.topUsers.length > 0 && (
              <ActionsTable
                title="Top wallets"
                columns={["Usuario", "Envíos", "Volumen", "Promedio", "Tokens", "Último"]}
                rows={sendInsights.topUsers.map((item) => [
                  renderUserLabel(item),
                  formatNumber(item.count),
                  formatAmount(item.totalAmount),
                  item.avgAmount != null ? formatAmount(item.avgAmount) : "—",
                  item.tokens?.length ? item.tokens.join(", ") : "—",
                  formatDateTime(item.lastAt),
                ])}
              />
            )}
            {sendInsights.tokens.length > 0 && (
              <ActionsTable
                title="Tokens enviados"
                columns={["Token", "Envíos", "Volumen"]}
                rows={sendInsights.tokens.map((token) => [
                  token.token || "—",
                  formatNumber(token.count),
                  formatAmount(token.totalAmount),
                ])}
              />
            )}
          </div>
        )}
      </section>

      <section className="actions-section">
        <h3>Requests</h3>
        <div className="actions-grid">
          <ActionCard label="Total histórico" value={formatNumber(requestInsights.lifetimeTotal)} icon="♾️" />
          <ActionCard label="Requests periodo" value={formatNumber(requestInsights.periodCount)} icon="🧾" />
          <ActionCard label="Importe periodo" value={formatAmount(requestInsights.periodAmount)} icon="💰" />
          <ActionCard
            label="Promedio periodo"
            value={requestAvgPeriod != null ? formatAmount(requestAvgPeriod) : "—"}
            icon="📊"
          />
        </div>
        {requestInsights.topUsers.length > 0 && (
          <div className="actions-detail">
            <ActionsTable
              title="Top solicitantes"
              columns={["Usuario", "Requests", "Importe", "Promedio", "Tokens", "Último"]}
              rows={requestInsights.topUsers.map((item) => [
                renderUserLabel(item),
                formatNumber(item.count),
                formatAmount(item.totalAmount),
                item.avgAmount != null ? formatAmount(item.avgAmount) : "—",
                item.tokens?.length ? item.tokens.join(", ") : "—",
                formatDateTime(item.lastAt),
              ])}
            />
          </div>
        )}
      </section>

      <section className="actions-section">
        <h3>Buy</h3>
        <div className="actions-grid">
          <ActionCard label="Total histórico" value={formatNumber(buyInsights.lifetimeTotal)} icon="♾️" />
          <ActionCard label="Compras periodo" value={formatNumber(buyInsights.periodCount)} icon="🛒" />
          <ActionCard label="Volumen periodo" value={formatAmount(buyInsights.periodVolume)} icon="📈" />
          <ActionCard
            label="Promedio periodo"
            value={buyAvgPeriod != null ? formatAmount(buyAvgPeriod) : "—"}
            icon="📊"
          />
        </div>
        {(buyInsights.topUsers.length > 0 || buyInsights.tokens.length > 0) && (
          <div className="actions-detail">
            {buyInsights.topUsers.length > 0 && (
              <ActionsTable
                title="Top compradores"
                columns={["Usuario", "Compras", "Volumen token", "Importe SOL", "Tokens", "Último"]}
                rows={buyInsights.topUsers.map((item) => [
                  renderUserLabel(item),
                  formatNumber(item.count),
                  formatAmount(item.totalVolume),
                  formatAmount(item.totalAmountSol),
                  item.tokens?.length ? item.tokens.join(", ") : "—",
                  formatDateTime(item.lastAt),
                ])}
              />
            )}
            {buyInsights.tokens.length > 0 && (
              <ActionsTable
                title="Tokens comprados"
                columns={["Token", "Compras", "Volumen"]}
                rows={buyInsights.tokens.map((token) => [
                  token.token || "—",
                  formatNumber(token.count),
                  formatAmount(token.totalVolume),
                ])}
              />
            )}
          </div>
        )}
      </section>

      <section className="actions-section">
        <h3>Agreements</h3>
        <div className="actions-grid">
          <ActionCard label="Total histórico" value={formatNumber(agreementInsights.lifetimeTotal)} icon="♾️" />
          <ActionCard label="Creados periodo" value={formatNumber(agreementInsights.periodCreated)} icon="📝" />
          <ActionCard label="Firmados periodo" value={formatNumber(agreementInsights.periodSigned)} icon="✍️" />
          <ActionCard label="Settled periodo" value={formatNumber(agreementInsights.periodSettled)} icon="✅" />
          <ActionCard label="Closure rate periodo" value={formatPercent(agreementClosureRate)} icon="📈" />
        </div>
        {(agreementInsights.topCreators.length > 0 ||
          agreementInsights.topSigners.length > 0 ||
          agreementInsights.settlements.length > 0) && (
          <div className="actions-detail">
            {agreementInsights.topCreators.length > 0 && (
              <ActionsTable
                title="Creadores"
                columns={["Usuario", "Creó", "Contrapartes", "Último"]}
                rows={agreementInsights.topCreators.map((item) => [
                  renderUserLabel(item),
                  formatNumber(item.count),
                  item.counterparts?.length
                    ? item.counterparts.map((wallet) => shortenWallet(wallet)).join(", ")
                    : "—",
                  formatDateTime(item.lastAt),
                ])}
              />
            )}
            {agreementInsights.topSigners.length > 0 && (
              <ActionsTable
                title="Firmantes"
                columns={["Usuario", "Firmó", "Etapas", "Último"]}
                rows={agreementInsights.topSigners.map((item) => [
                  renderUserLabel(item),
                  formatNumber(item.count),
                  item.stages?.length ? item.stages.join(", ") : "—",
                  formatDateTime(item.lastAt),
                ])}
              />
            )}
            {agreementInsights.settlements.length > 0 && (
              <ActionsTable
                title="Liquidaciones"
                columns={["Usuario", "Liquidó", "Último"]}
                rows={agreementInsights.settlements.map((item) => [
                  renderUserLabel(item),
                  formatNumber(item.count),
                  formatDateTime(item.lastAt),
                ])}
              />
            )}
          </div>
        )}
      </section>

      <section className="actions-section actions-section--aux">
        <h3>Mensajería directa & relay (telemetría)</h3>
        <div className="actions-grid">
          <ActionCard label="DM iniciados" value={formatNumber(messaging.dmStarted)} icon="💬" />
          <ActionCard label="DM aceptados" value={formatNumber(messaging.dmAccepted)} icon="🤝" />
          <ActionCard label="Relay msgs" value={formatNumber(messaging.relayMessages)} icon="📡" />
          <ActionCard label="DM iniciados 24h" value={formatNumber(messaging.dmStarted24h)} icon="⚡" />
          <ActionCard label="DM aceptados 24h" value={formatNumber(messaging.dmAccepted24h)} icon="🎯" />
          <ActionCard label="Relay msgs 24h" value={formatNumber(messaging.relayMessages24h)} icon="📨" />
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
          <li>
            <code>logActionSend</code> y <code>logActionSendFailed</code> se emiten desde{" "}
            <code>actionMessaging.service</code> al despachar fondos o capturar fallos.
          </li>
          <li>
            Las requests disparan <code>logActionRequestCreated</code> y{" "}
            <code>logActionRequestCompleted</code> en los controladores y servicios de Actions.
          </li>
          <li>
            Las compras usan <code>logActionBuy</code>/<code>logActionBuyFailed</code> en{" "}
            <code>buyBlink.controller</code>, propagando token, amountInSol y volumen recibido.
          </li>
          <li>
            Agreements registra created/signed/settled en su controlador para ambos participantes.
          </li>
          <li>
            Todos los eventos pasan por <code>actionEvents.service</code> → <code>safeLog</code>, que
            incrementa contadores en <code>Stats</code> sin bloquear el flujo principal.
          </li>
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

function ActionsTable({ title, columns, rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="actions-table">
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
