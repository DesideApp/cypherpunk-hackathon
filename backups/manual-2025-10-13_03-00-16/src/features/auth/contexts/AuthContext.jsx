import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { panelEvents } from "@wallet-adapter/ui/system/panel-bus";
import { useAuthenticateWallet } from "@features/auth/hooks/useAuthenticateWallet.js";

export const AUTH_STATUS = {
  LOGGED_OUT: "loggedOut",
  CONNECTING: "connecting",
  AUTHENTICATING: "authenticating",
  READY: "ready",
  SWITCHING: "switchingAccount",
  REAUTH_REQUIRED: "reauthRequired",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { connected, publicKey, disconnect } = useWallet();
  const authenticateWalletHook = useAuthenticateWallet(); // Renombrar para evitar conflicto

  const [status, setStatus] = useState(AUTH_STATUS.LOGGED_OUT);
  const isAuthenticated = status === AUTH_STATUS.READY;

  // Orquestación: cuando se conecta la wallet, NO auto-disparar firma
  // Solo actualizar estado y esperar llamada manual a authenticateWallet()
  useEffect(() => {
    if (!connected || !publicKey) {
      if (status !== AUTH_STATUS.CONNECTING) {
        console.debug('[AuthContext] Wallet disconnected, setting LOGGED_OUT');
        setStatus(AUTH_STATUS.LOGGED_OUT);
      }
      return;
    }

    // Si ya está listo o autenticando, no hacer nada
    if (status === AUTH_STATUS.READY || status === AUTH_STATUS.AUTHENTICATING) {
      return;
    }

    // 🚫 NO auto-disparar firma aquí
    console.debug('[AuthContext] Wallet connected, waiting for manual authentication');
    
  }, [connected, publicKey, status]);

  const authenticateWallet = useCallback(async () => {
    // Si no hay wallet conectada, no podemos autenticar
    if (!connected || !publicKey) {
      console.warn('[AuthContext] Cannot authenticate: no wallet connected');
      throw new Error('No wallet connected');
    }

    // Si ya está listo, no hacer nada
    if (status === AUTH_STATUS.READY) {
      console.debug('[AuthContext] Already authenticated');
      return { status: 'authenticated' };
    }

    console.debug('[AuthContext] Starting manual authentication');
    setStatus(AUTH_STATUS.AUTHENTICATING);

    try {
      const res = await authenticateWalletHook();
      if (res && res.status === "authenticated") {
        console.debug('[AuthContext] Authentication successful');
        setStatus(AUTH_STATUS.READY);
        return res;
      } else {
        console.warn('[AuthContext] Authentication failed:', res);
        setStatus(AUTH_STATUS.LOGGED_OUT);
        throw new Error(res?.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('[AuthContext] Authentication error:', error);
      setStatus(AUTH_STATUS.LOGGED_OUT);
      throw error;
    }
  }, [connected, publicKey, status, authenticateWalletHook]);

  const login = useCallback(async () => {
    // Si aún no hay wallet, abrimos el panel y dejamos que el usuario elija
    if (!connected || !publicKey) {
      setStatus(AUTH_STATUS.CONNECTING);
      panelEvents.open("connect");
      return;
    }
    // Wallet conectada pero falta firma → la lanzamos
    if (status !== AUTH_STATUS.READY) {
      setStatus(AUTH_STATUS.AUTHENTICATING);
      try {
        const res = await authenticateWallet();
        if (res && res.status === "authenticated") {
          setStatus(AUTH_STATUS.READY);
        } else {
          // ❗ No desconectamos la wallet ni emitimos eventos: permitimos reintento inmediato
          setStatus(AUTH_STATUS.LOGGED_OUT);
        }
      } catch (_e) {
        // ❗ En error también evitamos disconnect/evento para mantener la wallet lista para reintentar
        setStatus(AUTH_STATUS.LOGGED_OUT);
      }
    }
  }, [connected, publicKey, status, authenticateWallet]);

  const logout = useCallback(async () => {
    try { await disconnect(); } catch {}
    setStatus(AUTH_STATUS.LOGGED_OUT);
    // No emitimos aquí: WalletProvider ya lo hace en disconnect() y en accountChanged → null
  }, [disconnect]);

  const value = useMemo(
    () => ({ 
      status, 
      isAuthenticated, 
      login, 
      logout, 
      authenticateWallet  // 👈 Exponer para uso manual
    }),
    [status, isAuthenticated, login, logout, authenticateWallet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
