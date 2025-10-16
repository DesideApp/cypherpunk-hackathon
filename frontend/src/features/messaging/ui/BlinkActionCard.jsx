import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { SOLANA } from "@shared/config/env.js";
import "./BlinkActionCard.css";

function buildExplorerUrl(signature) {
  if (!signature) return null;
  const base = "https://solscan.io/tx/";
  const cluster = (SOLANA?.CHAIN || "").toLowerCase();
  const isMainnet = cluster === "mainnet-beta" || cluster === "mainnet";
  const suffix = isMainnet || !cluster ? "" : `?cluster=${cluster}`;
  return `${base}${signature}${suffix}`;
}

function short(value) {
  if (!value) return "";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function BlinkActionCard({ msg = {} }) {
  const isMine = msg?.sender === "me";
  const blink = msg?.blinkAction || {};
  const variant = isMine ? "own" : "contact";

  const token = blink.token || null;
  const amountInSol = blink.amountInSol || null;
  const expectedOut = blink.expectedOut || null;
  const txSig = blink.txSig || null;
  const explorerUrl = useMemo(() => buildExplorerUrl(txSig), [txSig]);
  const createdLabel = useMemo(() => {
    if (!blink.createdAt) return null;
    const date = new Date(blink.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [blink.createdAt]);
  const baseAmountNumber = useMemo(() => {
    const numeric = Number(amountInSol);
    return Number.isFinite(numeric) ? numeric : null;
  }, [amountInSol]);

  const primaryLabel = isMine ? null : "Comprar";
  const infoText = isMine
    ? "Compra completada y compartida con tu contacto."
    : "Tu contacto acaba de ejecutar este blink. Ábrelo para revisarlo o repetirlo.";

  const metaRows = useMemo(() => {
    const rows = [];
    if (amountInSol !== null && amountInSol !== undefined && amountInSol !== "") {
      rows.push({ label: "Gastado", value: `${amountInSol} SOL` });
    }
    if (expectedOut && token) {
      rows.push({ label: "Recibido", value: `≈ ${expectedOut} ${token}` });
    } else if (token) {
      rows.push({ label: "Token", value: token });
    }
    if (blink.source) {
      rows.push({ label: "Origen", value: blink.source });
    }
    if (txSig && !explorerUrl) {
      rows.push({ label: "Tx", value: short(txSig) });
    }
    return rows;
  }, [amountInSol, expectedOut, token, blink.source, txSig, explorerUrl]);

  const handleOpen = () => {
    if (!token) return;
    const amountDetail =
      baseAmountNumber !== null
        ? baseAmountNumber
        : amountInSol ?? blink?.meta?.amountInSol ?? null;
    if (amountDetail === null || amountDetail === undefined || amountDetail === "") return;
    window.dispatchEvent(
      new CustomEvent("chat:blink:buy", {
        detail: {
          token,
          amount: amountDetail,
          multiplier: 1,
          shareOnComplete: false,
        },
      })
    );
  };

  return (
    <div className={`blink-card-wrapper blink-card-wrapper--${variant}`} role="group" aria-label="Blink action">
      <div className={`blink-card blink-card--${variant}`}>
        <header className="blink-card-header">
          <div className="blink-card-heading">
            <p className="blink-card-title">{token ? `Blink · ${token}` : "Blink action"}</p>
            {createdLabel && <span className="blink-card-date">{createdLabel}</span>}
          </div>
          <span className="blink-card-chip">{(blink.kind || "blink").toUpperCase()}</span>
        </header>

        <p className="blink-card-subtitle">
          {isMine ? "Compartido con tu contacto" : "Compartido por tu contacto"}
        </p>

        {metaRows.length > 0 && (
          <div className="blink-card-meta">
            {metaRows.map(({ label, value }, idx) => (
              <React.Fragment key={`${label}-${idx}`}>
                <span className="blink-card-meta-label">{label}</span>
                <span className="blink-card-meta-value">{value}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        <p className="blink-card-note">{infoText}</p>

        {!isMine && token && baseAmountNumber !== null && (
          <div className="blink-card-quick-actions">
            {[1, 2, 5, 10].map((multiplier) => {
              const next = baseAmountNumber * multiplier;
              const formatted = Number(next.toFixed(6)).toString().replace(/\.?0+$/, "");
              return (
                <button
                  type="button"
                  key={`mult-${multiplier}`}
                  className="payment-card-secondary blink-card-quick"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("chat:blink:buy", {
                        detail: { token, amount: formatted, multiplier, shareOnComplete: false },
                      })
                    );
                  }}
                >
                  {multiplier === 1 ? "Igual" : `x${multiplier}`}
                </button>
              );
            })}
          </div>
        )}

        <footer className="blink-card-footer">
          {!isMine && primaryLabel && (
            <button type="button" className="payment-card-primary blink-card-primary" onClick={handleOpen}>
              {primaryLabel}
            </button>
          )}
          {isMine && explorerUrl && (
            <a
              className="payment-card-secondary"
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver tx ↗
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}

BlinkActionCard.propTypes = {
  msg: PropTypes.shape({
    sender: PropTypes.string,
    blinkAction: PropTypes.shape({
      kind: PropTypes.string,
      token: PropTypes.string,
      amountInSol: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      expectedOut: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      actionUrl: PropTypes.string,
      solanaActionUrl: PropTypes.string,
      dialToUrl: PropTypes.string,
      blinkApiUrl: PropTypes.string,
      txSig: PropTypes.string,
      source: PropTypes.string,
      createdAt: PropTypes.number,
    }),
  }),
};

BlinkActionCard.defaultProps = {
  msg: {},
};
