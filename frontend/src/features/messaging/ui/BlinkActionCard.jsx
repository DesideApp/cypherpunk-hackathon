import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { SOLANA } from "@shared/config/env.js";
import ActionCardBase from "@shared/ui/bubbles/ActionCardBase.jsx";

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

export default function BlinkActionCard({ msg = {}, direction = "received" }) {
  const isMine = direction === "sent";
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

  const primaryLabel = isMine ? null : "Buy";
  const infoText = isMine
    ? "Purchase completed and shared with your contact."
    : "Your contact just executed this blink. Open it to review or repeat.";

  const metaRows = useMemo(() => {
    const rows = [];
    if (amountInSol !== null && amountInSol !== undefined && amountInSol !== "") {
      rows.push({ id: "spent", label: "Spent", value: `${amountInSol} SOL` });
    }
    if (expectedOut && token) {
      rows.push({ id: "received", label: "Received", value: `≈ ${expectedOut} ${token}` });
    } else if (token) {
      rows.push({ id: "token", label: "Token", value: token });
    }
    if (blink.source) {
      rows.push({ id: "source", label: "Source", value: blink.source });
    }
    if (txSig) {
      rows.push({
        id: "tx",
        label: "Tx",
        value: short(txSig),
        link: explorerUrl || undefined,
      });
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

  const bodyContent = (
    <>
      <p className="bubble-action-card__note blink-card-note">{infoText}</p>

      {!isMine && token && baseAmountNumber !== null && (
        <div className="bubble-action-card__quick-actions">
          {[1, 2, 5, 10].map((multiplier) => {
            const next = baseAmountNumber * multiplier;
            const formatted = Number(next.toFixed(6)).toString().replace(/\.?0+$/, "");
            return (
              <button
                type="button"
                key={`mult-${multiplier}`}
                className="bubble-action-card__quick-button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("chat:blink:buy", {
                      detail: { token, amount: formatted, multiplier, shareOnComplete: false },
                    })
                  );
                }}
              >
                {multiplier === 1 ? "Same" : `x${multiplier}`}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const footerContent = (
    <div className="bubble-action-card__button-group">
      {!isMine && primaryLabel && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--primary"
          onClick={handleOpen}
        >
          {primaryLabel}
        </button>
      )}
      {isMine && explorerUrl && (
        <a
          className="bubble-action-card__button bubble-action-card__button--secondary bubble-action-card__button--link"
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
        >
          View tx
        </a>
      )}
    </div>
  );

  return (
    <ActionCardBase
      variant={variant}
      title="Blink"
      metaRows={metaRows}
      body={bodyContent}
      footer={footerContent}
      ariaLabel="Blink action"
    />
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
