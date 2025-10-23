import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import type { BaseWalletAdapter } from '@wallet-adapter/core/adapters/BaseWalletAdapter';
import { TrustedWalletList } from './TrustedWalletList';
import { UntrustedWalletList } from './UntrustedWalletList';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';

type Props = { onConnected?: () => void; showHeading?: boolean; padding?: string };

/** Orden “pinned” (usa los nombres EXACTOS de los adapters). */
const ORDER = ['Phantom', 'Solflare', 'Backpack', 'MagicEden'] as const;
const orderIndex = (n: string) => {
  const i = ORDER.indexOf(n as any);
  return i === -1 ? 999 : i;
};

/* ===================== Estilos del “body” rígido ===================== */

const BASE_ROOT_STYLE: CSSProperties = {
  // El Shell se adapta a este bloque; aquí fijamos la “caja” visual del panel
  width: '100%',
  boxSizing: 'border-box',
  display: 'grid',
  gap: 14,
};

const DEFAULT_ROOT_PADDING = '22px clamp(20px, 6vw, 28px) calc(18px + var(--safe-area-bottom, 0px))';

const headerWrap: CSSProperties = {
  display: 'grid',
  gap: 6,
};

const titleStyle: CSSProperties = {
  fontFamily: getCssVariable('--font-title-family'),
  fontSize: getCssVariable('--font-title-size'),
  fontWeight: getCssVariable('--font-title-weight'),
  color: getCssVariable('--text-primary'),
  letterSpacing: 0.2,
};

const microStyle: CSSProperties = {
  fontFamily: getCssVariable('--font-data-family'),
  fontSize: getCssVariable('--font-data-size'),
  fontWeight: getCssVariable('--font-data-weight'),
  color: getCssVariable('--text-secondary'),
  opacity: 0.9,
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 6,
  marginBottom: 6,
  paddingLeft: 0,
  fontFamily: getCssVariable('--font-navigation-family'),
  fontSize: 13,
  fontWeight: 600,
  color: getCssVariable('--text-primary'),
};

/* ==================================================================== */

export const UnifiedWalletList = ({ onConnected, showHeading = true, padding }: Props) => {
  const {
    connect,
    status,                 // 'idle' | 'connecting' | 'connected' | 'locked' | 'error'
    adaptersTrusted,        // del AdapterManager: “installed”
    adaptersUntrusted,      // del AdapterManager: “others”
  } = useWallet();

  // Pequeña gracia para evitar parpadeos al montar
  const [graceDone, setGraceDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraceDone(true), 120);
    return () => clearTimeout(t);
  }, []);

  // 1) Dedupe + unificación: trabajamos siempre con TODAS las wallets conocidas
  const allAdapters = useMemo(() => {
    const map = new Map<string, BaseWalletAdapter>();
    for (const a of [...(adaptersTrusted ?? []), ...(adaptersUntrusted ?? [])]) {
      if (!map.has(a.name)) map.set(a.name, a);
    }
    return Array.from(map.values());
  }, [adaptersTrusted, adaptersUntrusted]);

  // 2) Clasificación final por disponibilidad real del provider
  const installed = useMemo(
    () => allAdapters.filter((a) => !!a.available),
    [allAdapters]
  );
  const others = useMemo(
    () => allAdapters.filter((a) => !a.available),
    [allAdapters]
  );

  // 3) “Recently used” → arriba dentro del bloque correspondiente
  const recentlyUsedName = useMemo<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem('wa:lastConnectedWallet') ??
      window.localStorage.getItem('wa:lastWallet')
    );
  }, []);

  // 4) Orden estable: Recently used → Pinned → A–Z
  const sortWallets = useCallback((arr: BaseWalletAdapter[]) => {
    return arr.slice().sort((a, b) => {
      const aRecent = a.name === recentlyUsedName ? -1 : 0;
      const bRecent = b.name === recentlyUsedName ? -1 : 0;
      if (aRecent !== bRecent) return aRecent - bRecent;

      const pinned = orderIndex(a.name) - orderIndex(b.name);
      if (pinned !== 0) return pinned;

      return a.name.localeCompare(b.name);
    });
  }, [recentlyUsedName]);

  const installedSorted = useMemo(
    () => sortWallets(installed),
    [installed, sortWallets]
  );
  const othersSorted = useMemo(
    () => sortWallets(others),
    [others, sortWallets]
  );

  const isConnecting = status === 'connecting';

  const handleConnect = async (name: string) => {
    try {
      await connect(name);
      onConnected?.();
    } catch {
      // “locked”/errores se señalan fuera; no cerramos aquí.
    }
  };

  // Bloquea interacción mientras connecting
  const listsState: CSSProperties = isConnecting
    ? { opacity: 0.6, pointerEvents: 'none' }
    : {};

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      ...BASE_ROOT_STYLE,
      padding: padding ?? DEFAULT_ROOT_PADDING,
    }),
    [padding]
  );

  return (
    <div style={rootStyle} aria-busy={isConnecting}>
      {/* Encabezado rígido (título + microcopy) */}
      {showHeading && (
        <div style={headerWrap}>
          <div style={titleStyle}>Choose a wallet</div>
          <div style={microStyle}>
            Installed wallets appear first. You can also install another option below.
          </div>
        </div>
      )}

      {/* Secciones */}
      <div style={listsState}>
        {graceDone && installedSorted.length > 0 && (
          <>
            <div style={sectionTitleStyle}>Installed wallets</div>
            <TrustedWalletList
              wallets={installedSorted}
              onConnect={handleConnect}
              disabled={isConnecting}
              // Si tu componente soporta chip de “Recently used”, pásalo:
              // @ts-ignore opcional–compat
              recentlyUsedName={recentlyUsedName ?? undefined}
            />
          </>
        )}

        {graceDone && othersSorted.length > 0 && (
          <>
            <div style={sectionTitleStyle}>Other options</div>
            <UntrustedWalletList
              wallets={othersSorted}
              onConnect={handleConnect}
              disabled={isConnecting}
              // @ts-ignore opcional–compat
              recentlyUsedName={recentlyUsedName ?? undefined}
            />
          </>
        )}

        {/* Fallback extremo: no hay ninguno (raro, pero mejor copy amable) */}
        {graceDone &&
          installedSorted.length === 0 &&
          othersSorted.length === 0 && (
            <div style={microStyle}>
              No wallets detected. Please install one to continue.
            </div>
          )}
      </div>

      {/* Mensajes de estado no intrusivos */}
      {status === 'locked' && (
        <div
          style={{
            ...microStyle,
            padding: '8px 12px',
            backgroundColor: getCssVariable('--hover-overlay'),
            border: `1px solid ${getCssVariable('--border-color')}`,
            borderRadius: 8,
          }}
        >
          Wallet locked. Please unlock it.
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            ...microStyle,
            color: 'red',
            padding: '8px 12px',
            backgroundColor: getCssVariable('--hover-overlay'),
            border: `1px solid ${getCssVariable('--border-color')}`,
            borderRadius: 8,
          }}
        >
          Error connecting to wallet.
        </div>
      )}
    </div>
  );
};

export default UnifiedWalletList;
