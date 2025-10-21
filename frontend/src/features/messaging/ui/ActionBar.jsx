import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Plus } from "lucide-react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useSolanaBalance } from "@wallet-adapter/core/hooks/useSolanaBalance";
import { panelEvents } from "@wallet-adapter/ui/system/panel-bus";
import { MOCKS } from "@shared/config/env.js";

const ACTIONS = [
  {
    key: "send",
    label: "Send",
    title: "Send money",
  },
  {
    key: "request",
    label: "Request",
    title: "Request payment",
  },
  {
    key: "buy",
    label: "Buy",
    title: "Buy tokens",
  },
  {
    key: "fund",
    label: "Fund",
    title: "Fund wallet",
  },
  {
    key: "agreement",
    label: "Agreement",
    title: "On-chain agreement",
  },
];

function noop() {}

export default function ActionBar({
  onSend = noop,
  onRequest = noop,
  onBuy = noop,
  onBuyMock = noop,
  onFund = noop,
  onAgreement = noop,
  disabled = false,
  pendingKind = null,
  mode = "desktop",
}) {
  const { connected, status } = useWallet();
  const balance = useSolanaBalance();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = mode === "mobile";

  const renderFundChip = () => {
    const isPending = pendingKind === "fund";
    const isDisabled = disabled || status === "connecting";

    const handleBalanceClick = () => {
      const mode = connected ? "menu" : "connect";
      try { panelEvents.open(mode); } catch {}
    };

    const handleFundClick = () => {
      if (!connected) {
        try { panelEvents.open("connect"); } catch {}
        return;
      }
      if (typeof onFund === "function") onFund();
    };

    return (
      <div
        key="fund-chip"
        className={`action-bar-fund-chip${isPending ? " pending" : ""}${isDisabled ? " disabled" : ""}`}
        role="group"
        aria-label="Wallet balance and fund"
      >
        <button
          type="button"
          className="fund-balance-btn"
          onClick={handleBalanceClick}
          title={connected ? "Wallet menu" : "Connect wallet"}
          aria-label={connected ? "Open wallet menu" : "Connect wallet"}
          disabled={isDisabled}
        >
          {connected ? balance : (status === "connecting" ? "Connecting…" : "Connect")}
        </button>
        <button
          type="button"
          className="fund-plus-btn"
          onClick={handleFundClick}
          title="Add funds"
          aria-label="Add funds"
          disabled={isDisabled}
        >
          <Plus size={20} />
        </button>
      </div>
    );
  };
  const handlers = {
    send: onSend,
    request: onRequest,
    buy: onBuy,
    "buy-mock": onBuyMock,
    fund: onFund,
    agreement: onAgreement,
  };

  const actionList = useMemo(() => {
    const base = ACTIONS.slice();
    if (MOCKS.BLINK_BUY) {
      base.splice(3, 0, {
        key: "buy-mock",
        label: "Buy (mock)",
        title: "Send mock blink message",
      });
    }
    return base;
  }, []);

  const primaryKeys = isMobile ? ["send", "request"] : actionList.map((a) => a.key).filter((key) => key !== "fund");
  const menuKeys = isMobile
    ? actionList
        .map((a) => a.key)
        .filter((key) => !primaryKeys.includes(key) && key !== "fund")
    : [];
  const hasFundAction = actionList.some((action) => action.key === "fund");
  const shouldShowMoreTrigger = isMobile && (menuKeys.length > 0 || hasFundAction);

  return (
    <div className={`action-bar ${isMobile ? "action-bar--mobile" : ""}`} role="group" aria-label="Quick actions">
      <div className="action-bar-left">
        {actionList.filter(({ key }) => primaryKeys.includes(key)).map(({ key, label, title }) => {
          const isPending = pendingKind === key;
          const handler = handlers[key] || noop;
          const isDisabled = disabled;
          return (
            <button
              key={key}
              type="button"
              className={`action-bar-button${isPending ? " pending" : ""}${isDisabled ? " disabled" : ""}`}
              onClick={() => {
                if (typeof handler === "function") handler();
              }}
              title={title}
              aria-label={title}
              aria-disabled={isDisabled}
            >
              <span>{label}</span>
            </button>
          );
        })}

        {shouldShowMoreTrigger && (
          <div className="action-bar-more">
            <button
              type="button"
              className="action-bar-button action-bar-more__trigger"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              More
            </button>
          </div>
        )}
      </div>
      {!isMobile && (
        <div className="action-bar-right">
          {renderFundChip()}
        </div>
      )}
      {isMobile && moreOpen && (
        <div className="action-bar-more__overlay" role="presentation" onClick={() => setMoreOpen(false)}>
          <div className="action-bar-more__sheet" role="menu" aria-label="More actions" onClick={(e) => e.stopPropagation()}>
            <h3 className="action-bar-more__title">More actions</h3>
            <div className="action-bar-more__list">
              {menuKeys.map((key) => {
                const action = actionList.find((item) => item.key === key);
                if (!action) return null;
                const handler = handlers[key] || noop;
                const isPending = pendingKind === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`action-bar-more__item${isPending ? " pending" : ""}`}
                    onClick={() => {
                      setMoreOpen(false);
                      handler();
                    }}
                    role="menuitem"
                  >
                    {action.label}
                  </button>
                );
              })}
              {hasFundAction && (
                <button
                  type="button"
                  className="action-bar-more__item"
                  onClick={() => {
                    setMoreOpen(false);
                    const handler = handlers["fund"] || noop;
                    handler();
                  }}
                  role="menuitem"
                >
                  Fund wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ActionBar.propTypes = {
  onSend: PropTypes.func,
  onRequest: PropTypes.func,
  onBuy: PropTypes.func,
  onBuyMock: PropTypes.func,
  onFund: PropTypes.func,
  onAgreement: PropTypes.func,
  disabled: PropTypes.bool,
  pendingKind: PropTypes.oneOf(["send", "request", "agreement", null]),
  mode: PropTypes.oneOf(["desktop", "mobile"]),
};
