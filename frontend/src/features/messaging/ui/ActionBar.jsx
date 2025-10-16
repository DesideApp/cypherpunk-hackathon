import React from "react";
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
}) {
  const { connected, status } = useWallet();
  const balance = useSolanaBalance();

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

  const actionList = React.useMemo(() => {
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

  return (
    <div className="action-bar" role="group" aria-label="Quick actions">
      <div className="action-bar-left">
        {actionList.map(({ key, label, title }) => {
          if (key === "fund") return null;
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
      </div>
      <div className="action-bar-right">
        {renderFundChip()}
      </div>
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
};
