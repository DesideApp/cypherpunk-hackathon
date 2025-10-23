import { useMemo } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useSolanaBalance } from "@wallet-adapter/core/hooks/useSolanaBalance";
import { panelEvents } from "@features/auth/ui/system/panel-bus";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import "./WalletBalanceWidget.css";

function formatPubkey(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const WalletBalanceWidget = ({ className = "" }) => {
  const { isMobile } = useLayout();
  const { publicKey, status, connected } = useWallet();
  const balance = useSolanaBalance();

  const compactAddress = useMemo(() => formatPubkey(publicKey), [publicKey]);
  const statusLabel = useMemo(() => {
    if (status === "connecting") return "Connecting…";
    if (!connected) return "Wallet not connected";
    return compactAddress || "Wallet ready";
  }, [status, connected, compactAddress]);

  const handleManageClick = () => {
    const mode = connected ? "menu" : "connect";
    try {
      panelEvents.open(mode);
    } catch (error) {
      console.warn("[WalletBalanceWidget] Unable to open wallet panel:", error);
    }
  };

  if (isMobile) return null;

  const widgetClassName = [
    "wallet-balance-widget",
    connected ? "is-connected" : "is-disconnected",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={widgetClassName} aria-live="polite" aria-atomic="true">
      <header className="wallet-balance-header">
        <span className="wallet-balance-label">Wallet</span>
        <button
          type="button"
          className="wallet-balance-manage"
          onClick={handleManageClick}
        >
          {connected ? "Manage" : "Connect"}
        </button>
      </header>

      <div className="wallet-balance-amount">
        {connected ? balance : "—"}
      </div>

      <p className="wallet-balance-subtext">{statusLabel}</p>
    </section>
  );
};

export default WalletBalanceWidget;
