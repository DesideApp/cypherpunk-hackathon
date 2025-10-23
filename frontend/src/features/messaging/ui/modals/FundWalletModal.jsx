import React, { useState, useMemo } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
import { ModalShell, UiButton, UiChip } from "@shared/ui";

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
      <div className="action-modal-actions">
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
      </div>
    );

    return (
      <ModalShell
        open={open}
        onClose={handleClose}
        title="Completar pago"
        footer={demoFooter}
        size="lg"
      >
        <div className="action-modal-section">
          <div className="action-modal-insight" style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
            <div style={{ fontSize: '3rem', textAlign: 'center' }}>{provider?.icon}</div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{provider?.name} - Demo Mode</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p><strong>Monto:</strong> ${activeAmount} USD</p>
              <p><strong>Recibirás:</strong> ~{(activeAmount / 150).toFixed(4)} SOL</p>
              <p><strong>Wallet:</strong> {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}</p>
              <p><strong>Proveedor:</strong> {provider?.name}</p>
            </div>
          </div>

          <div className="action-modal-insight" style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
            <p>🎭 <strong>Modo Demo</strong></p>
            <p>En producción, aquí se integraría con un proveedor on-ramp real como:</p>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              <li>Coinflow (Solana nativo)</li>
              <li>Transak (Global)</li>
              <li>MoonPay (Popular)</li>
              <li>Ramp Network</li>
            </ul>
            <p style={{ marginBottom: 0 }}>El usuario completaría el pago con tarjeta de crédito/débito y los fondos llegarían automáticamente a su wallet.</p>
          </div>
        </div>
      </ModalShell>
    );
  }

  // Vista de selección
  const selectionFooter = (
    <div className="action-modal-actions">
      <UiButton variant="secondary" onClick={handleClose} disabled={busy}>
        Cancelar
      </UiButton>
      <UiButton onClick={handleFund} disabled={busy || !walletAddress || !activeAmount}>
        {busy ? "Abriendo..." : `Fondear ${activeAmount ? `$${activeAmount}` : ""}`}
      </UiButton>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Fondear Wallet"
      footer={selectionFooter}
      size="md"
    >
      <div className="action-modal-section">
        <div className="action-modal-insight">
          <span className="action-modal-insight-label">Tu wallet:</span>
          <code className="action-modal-insight-value">
            {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : "No conectada"}
          </code>
        </div>

        <div className="action-modal-field">
          <span className="action-modal-field-label">Selecciona el monto:</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
            {FUND_OPTIONS.map((option) => {
              const isSelected = selectedAmount === option.amount && !customAmount;
              return (
                <UiChip
                  key={option.amount}
                  as="button"
                  type="button"
                  selected={isSelected}
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
        </div>

        <div className="action-modal-field">
          <span className="action-modal-field-label">O ingresa un monto personalizado:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>$</span>
            <input
              type="number"
              min="10"
              max="10000"
              step="10"
              placeholder="Ej: 150"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              disabled={busy}
              className="action-modal-input"
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>USD</span>
          </div>
        </div>

        <div className="action-modal-field">
          <span className="action-modal-field-label">Proveedor:</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {PROVIDER_OPTIONS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="action-modal-option-button"
                data-active={selectedProvider === provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                disabled={busy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  backgroundColor: selectedProvider === provider.id ? 'var(--color-surface-secondary)' : 'transparent',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{provider.icon}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{provider.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{provider.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {requiresKYC && (
          <div className="action-modal-insight" style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}>
            <span>⚠️ Este monto puede requerir verificación KYC en {activeProvider.name}</span>
          </div>
        )}

        <div className="action-modal-insight" style={{ fontSize: '0.875rem' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li>Los fondos llegarán directamente a tu wallet</li>
            <li>Tiempo estimado: 5-15 minutos</li>
            <li>Soporta tarjetas de crédito/débito</li>
          </ul>
        </div>
      </div>
    </ModalShell>
  );
}
