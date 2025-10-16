import React, { useState, useMemo } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
import { ModalShell, UiButton, UiChip } from "@shared/ui";
import "./FundWalletModal.css";

const FUND_OPTIONS = [
  { label: "$50", amount: 50 },
  { label: "$100", amount: 100 },
  { label: "$200", amount: 200 },
  { label: "$500", amount: 500 },
];

const PROVIDER_OPTIONS = [
  {
    id: "onramp1",
    name: "On-Ramp 1",
    description: "Solana nativo • Sin KYC hasta $500",
    icon: "💎",
    supportsNoKYC: true,
    maxNoKYC: 500,
  },
  {
    id: "onramp2",
    name: "On-Ramp 2",
    description: "Global • Sin KYC hasta $150",
    icon: "🌍",
    supportsNoKYC: true,
    maxNoKYC: 150,
  },
];

export default function FundWalletModal({ open, onClose }) {
  const { pubkey: myWallet } = useAuthManager();
  const walletCtx = useWallet();
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [selectedProvider, setSelectedProvider] = useState("onramp1");
  const [customAmount, setCustomAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const walletPublicKey = walletCtx?.publicKey;
  const walletAddress = useMemo(() => {
    if (walletPublicKey?.toBase58) {
      try {
        return walletPublicKey.toBase58();
      } catch (_) {
        return myWallet || null;
      }
    }
    if (typeof walletPublicKey === "string" && walletPublicKey) {
      return walletPublicKey;
    }
    return myWallet || null;
  }, [walletPublicKey, myWallet]);

  const activeAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const activeProvider = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider);

  const requiresKYC = activeProvider && activeAmount > activeProvider.maxNoKYC;

  const handleFund = async () => {
    if (!walletAddress) {
      notify("Conecta tu wallet primero", "warning");
      return;
    }

    if (!activeAmount || activeAmount <= 0) {
      notify("Ingresa una cantidad válida", "warning");
      return;
    }

    if (activeAmount < 10) {
      notify("El monto mínimo es $10 USD", "warning");
      return;
    }

    setBusy(true);

    try {
      // Demo mode - mostrar pantalla de ejemplo
      console.log(`[Fund Demo] Provider: ${activeProvider.name}, Amount: $${activeAmount}, Wallet: ${walletAddress}`);
      
      setShowDemo(true);
      notify(`${activeProvider.name} - Demo Mode`, "info");
    } catch (error) {
      console.error("Error opening fund provider:", error);
      notify(error?.message || "No se pudo abrir el proveedor", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => {
    setShowDemo(false);
    setBusy(false);
  };

  const handleClose = () => {
    setShowDemo(false);
    setBusy(false);
    onClose?.();
  };

  if (!open) return null;

  // Vista demo de pago
  if (showDemo) {
    const provider = PROVIDER_OPTIONS.find(p => p.id === selectedProvider);
    const demoFooter = (
      <>
        <UiButton variant="secondary" onClick={handleBack} disabled={busy}>
          Volver
        </UiButton>
        <UiButton
          onClick={() => {
            notify("Pago simulado completado", "success");
            handleClose();
          }}
          disabled={busy}
        >
          Simular pago completado
        </UiButton>
      </>
    );

    return (
      <ModalShell
        open={open}
        onClose={handleClose}
        title="Completar pago"
        footer={demoFooter}
        size="lg"
        modalProps={{ className: "fund-modal fund-modal-demo" }}
      >
        <div className="fund-demo-container">
          <div className="fund-demo-content">
            <div className="fund-demo-icon">{provider?.icon}</div>
            <h3 className="fund-demo-title">{provider?.name} - Demo Mode</h3>
            <div className="fund-demo-details">
              <p><strong>Monto:</strong> ${activeAmount} USD</p>
              <p><strong>Recibirás:</strong> ~{(activeAmount / 150).toFixed(4)} SOL</p>
              <p><strong>Wallet:</strong> {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}</p>
              <p><strong>Proveedor:</strong> {provider?.name}</p>
            </div>
            <div className="fund-demo-info">
              <p>🎭 <strong>Modo Demo</strong></p>
              <p>En producción, aquí se integraría con un proveedor on-ramp real como:</p>
              <ul>
                <li>Coinflow (Solana nativo)</li>
                <li>Transak (Global)</li>
                <li>MoonPay (Popular)</li>
                <li>Ramp Network</li>
              </ul>
              <p>El usuario completaría el pago con tarjeta de crédito/débito y los fondos llegarían automáticamente a su wallet.</p>
            </div>
          </div>
        </div>
      </ModalShell>
    );
  }

  // Vista de selección
  const selectionFooter = (
    <>
      <UiButton variant="secondary" onClick={handleClose} disabled={busy}>
        Cancelar
      </UiButton>
      <UiButton onClick={handleFund} disabled={busy || !walletAddress || !activeAmount}>
        {busy ? "Abriendo..." : `Fondear ${activeAmount ? `$${activeAmount}` : ""}`}
      </UiButton>
    </>
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Fondear Wallet"
      footer={selectionFooter}
      modalProps={{ className: "fund-modal" }}
    >
      <div className="fund-modal-body">
        <div className="fund-wallet-info">
          <p className="fund-label">Tu wallet:</p>
          <code className="fund-wallet-address">
            {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : "No conectada"}
          </code>
        </div>

        <div className="fund-section">
          <label className="fund-label">Selecciona el monto:</label>
          <div className="fund-amount-grid">
            {FUND_OPTIONS.map((option) => {
              const isSelected = selectedAmount === option.amount && !customAmount;
              return (
                <UiChip
                  key={option.amount}
                  as="button"
                  type="button"
                  selected={isSelected}
                  className="fund-amount-chip"
                  onClick={() => {
                    setSelectedAmount(option.amount);
                    setCustomAmount("");
                  }}
                  disabled={busy}
                >
                  {option.label}
                </UiChip>
              );
            })}
          </div>

          <div className="fund-custom-amount">
            <label className="fund-label">O ingresa un monto personalizado:</label>
            <div className="fund-input-group">
              <span className="fund-currency">$</span>
              <input
                type="number"
                min="10"
                max="10000"
                step="10"
                placeholder="Ej: 150"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={busy}
                className="fund-input"
              />
              <span className="fund-currency-label">USD</span>
            </div>
          </div>
        </div>

        <div className="fund-section">
          <label className="fund-label">Proveedor:</label>
          <div className="fund-provider-grid">
            {PROVIDER_OPTIONS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`fund-provider-button${selectedProvider === provider.id ? " active" : ""}`}
                onClick={() => setSelectedProvider(provider.id)}
                disabled={busy}
              >
                <span className="fund-provider-icon">{provider.icon}</span>
                <div className="fund-provider-info">
                  <span className="fund-provider-name">{provider.name}</span>
                  <span className="fund-provider-desc">{provider.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {requiresKYC && (
          <div className="fund-warning">
            ⚠️ Este monto puede requerir verificación KYC en {activeProvider.name}
          </div>
        )}

        <div className="fund-info">
          <p>• Los fondos llegarán directamente a tu wallet</p>
          <p>• Tiempo estimado: 5-15 minutos</p>
          <p>• Soporta tarjetas de crédito/débito</p>
        </div>
      </div>
    </ModalShell>
  );
}
