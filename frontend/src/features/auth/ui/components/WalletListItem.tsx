import type { CSSProperties } from "react";
import type { BaseWalletAdapter } from "@wallet-adapter/core/adapters/BaseWalletAdapter";
import { walletIcons } from "@wallet-adapter/core/adapters/icons";
import { getCssVariable } from "@wallet-adapter/theme/getCssVariable";

export type WalletRowMode = "connect" | "install";

type Props = {
  adapter: BaseWalletAdapter;
  onConnect: (name: string) => void;
  mode: WalletRowMode;             // "connect" = popup ; "install" = web
  statusLabel: "Installed" | "Install";
  /** Varias chips opcionales (e.g., "Most popular", "Recently used") */
  metaChips?: string[];
  installHref?: string;
  disabled?: boolean;              // desactiva interacciones (p.ej., mientras connecting)
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 10,
  borderRadius: 10,
  transition: "background-color 0.15s ease-in-out, opacity 0.15s ease-in-out",
  backgroundColor: "transparent",
  border: "1px solid " + getCssVariable("--border-color"),
  width: "100%",
  textAlign: "left",
  fontFamily: getCssVariable("--font-ui-family"),
  fontSize: getCssVariable("--font-ui-size"),
  fontWeight: getCssVariable("--font-ui-weight"),
  color: getCssVariable("--text-primary"),
  cursor: "pointer",
};

const nameStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };

const rightWrap: CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export function WalletListItem({
  adapter,
  onConnect,
  mode,
  statusLabel,
  metaChips,
  installHref,
  disabled = false,
}: Props) {
  const iconSrc = walletIcons[adapter.name];

  const onClick = async () => {
    if (disabled) return;
    if (mode === "connect") {
      try {
        await onConnect(adapter.name);
      } catch {
        // El estado se muestra arriba; no lanzamos errores aquí.
      }
    } else {
      const href = installHref || (adapter as any).url;
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const ariaLabel =
    mode === "connect"
      ? `Connect ${adapter.name} wallet`
      : `Install ${adapter.name} wallet`;

  return (
    <div
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={0}
      data-wallet-name={adapter.name}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" ? onClick() : void 0)}
      style={{
        ...rowStyle,
        ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : null),
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = getCssVariable("--hover-overlay");
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div style={nameStyle}>
        {iconSrc && (
          <img
            src={iconSrc}
            width={22}
            height={22}
            style={{ marginRight: 8 }}
            alt={`${adapter.name} logo`}
          />
        )}
        {adapter.name}
      </div>

      <div style={rightWrap}>
        {metaChips?.map((chip) => (
          <span key={chip} className="wa-chip">
            {chip}
          </span>
        ))}
        <span className="wa-chip">{statusLabel}</span>
      </div>
    </div>
  );
}

/** Alias por compatibilidad con código previo */
export const WalletRow = WalletListItem;
