import { useState, useEffect, useRef, useCallback } from "react";
import { useServer } from "@features/auth/contexts/ServerContext.jsx";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import {
  refreshToken,
  clearSession,
  getStoredCSRFToken,
  readCookie,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@shared/services/tokenService.js";
import { useAuthenticateWallet } from "./useAuthenticateWallet";
import { notify } from "@shared/services/notificationService.js";
import { createDebugLogger } from "@shared/utils/debug.js";

const LOG = createDebugLogger("AuthManager", { envKey: "VITE_DEBUG_AUTH_LOGS" });

export const useAuthManager = () => {
  const {
    isAuthenticated,
    isReady,
    syncAuthStatus,
    resetAuth,
    isAdmin: serverIsAdmin,
    wallet: serverWallet,
    role: serverRole,
  } = useServer();
  const { publicKey, connected } = useWallet();
  const authenticateWallet = useAuthenticateWallet();

  const [isLoading, setIsLoading] = useState(true);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const isEnsuring = useRef(false);
  const pendingAuthRef = useRef(null);
  const ensurePromiseRef = useRef(null);
  const ensureOnceRef = useRef(null);

  // Estado interno
  const stateRef = useRef({
    walletConnected: false,
    walletAuthed: false,
    jwtValid: false,
  });

  // Marcador de si esta pestaña llegó a tener sesión válida alguna vez
  const hadAuthedRef = useRef(false);

  // Anti‑ruido de fallos
  const lastFailureRef = useRef({ ts: 0, reason: "" });
  const dedupeFail = (reason) => {
    const now = Date.now();
    if (now - lastFailureRef.current.ts < 1200 && reason === lastFailureRef.current.reason) {
      return true;
    }
    lastFailureRef.current = { ts: now, reason };
    return false;
  };

  const handleAuthFailure = useCallback(
    async (reason = "expired") => {
      if (dedupeFail(reason)) return;

      LOG("handleAuthFailure:", reason);

      if (reason === "expired") notify("Session expired. Please sign in again.", "warning");
      if (reason === "walletDisconnected") notify("Wallet disconnected.", "info");
      if (reason === "auth_failed") notify("Wallet authentication error.", "error");
      if (reason === "refresh_failed") notify("Could not refresh session.", "error");

      stateRef.current.jwtValid = false;
      stateRef.current.walletAuthed = false;
      setRequiresLogin(true);

      // Limpia estado backend + tokens/cookies
      resetAuth();
      clearSession(reason);
      // No desconectamos la wallet aquí.
    },
    [resetAuth]
  );

  /* Wallet → flags visibles */
  useEffect(() => {
    stateRef.current.walletConnected = connected;

    if (connected && publicKey) {
      const formatted =
        typeof publicKey === "string"
          ? publicKey
          : (publicKey.toBase58?.() ?? publicKey.toString?.() ?? String(publicKey));
      setSelectedWallet(formatted);
      LOG("wallet connected:", { connected: true, pubkey: formatted });
    } else {
      stateRef.current.walletAuthed = false;
      stateRef.current.jwtValid = false;
      setSelectedWallet(null);
      LOG("wallet disconnected");
    }

    setIsLoading(false);
  }, [publicKey, connected]);

  /* Server status → READY / authenticated */
  useEffect(() => {
    if (!isReady) return;
    setRequiresLogin(!isAuthenticated);
    stateRef.current.jwtValid = isAuthenticated;
    stateRef.current.walletAuthed =
      isAuthenticated && stateRef.current.walletConnected;

    LOG("server status:", { isReady, isAuthenticated });

    if (isAuthenticated) {
      hadAuthedRef.current = true; // esta pestaña ya tuvo sesión OK
    }
  }, [isAuthenticated, isReady]);

  // Detecta cancelación del usuario
  const isUserCancelError = (eOrRes) => {
    const s = eOrRes?.status || eOrRes?.code || eOrRes?.reason || eOrRes?.message;
    return (
      eOrRes?.cancelled === true ||
      eOrRes?.status === "cancelled" ||
      s === "USER_CANCELLED" ||
      s === "USER_CANCELED" ||
      s === "ERR_CANCELED" ||
      s === "ERR_CANCELLED"
    );
  };

  /* Expiración / desconexión (eventos globales) */
  useEffect(() => {
    const expiredHandler = (evt) => {
      const silent = Boolean(evt?.detail?.silent);
      const hasCookie = !!(readCookie(ACCESS_TOKEN_COOKIE) || readCookie(REFRESH_TOKEN_COOKIE));
      const hasClientCSRF = !!getStoredCSRFToken();

      const hadSession =
        hadAuthedRef.current || stateRef.current.jwtValid || hasCookie || hasClientCSRF;

      LOG("sessionExpired event:", { silent, hasCookie, hasClientCSRF, hadSession });

      if (!hadSession) {
        setRequiresLogin(true);
        if (!silent && hasCookie) {
          resetAuth();
          clearSession("bootstrap");
        }
        return;
      }

      handleAuthFailure("expired");
    };

    const walletHandler = () => {
      LOG("walletDisconnected event");
      handleAuthFailure("walletDisconnected");
    };

    window.addEventListener("sessionExpired", expiredHandler);
    window.addEventListener("walletDisconnected", walletHandler);
    return () => {
      window.removeEventListener("sessionExpired", expiredHandler);
      window.removeEventListener("walletDisconnected", walletHandler);
    };
  }, [handleAuthFailure, resetAuth]);

  /* Tras refresh OK, re-sincroniza con /status (evento emitido por refreshToken) */
  useEffect(() => {
    const onRefreshed = () => {
      LOG("sessionRefreshed event → syncing status");
      syncAuthStatus(true);
    };
    window.addEventListener("sessionRefreshed", onRefreshed);
    return () => window.removeEventListener("sessionRefreshed", onRefreshed);
  }, [syncAuthStatus]);

  /**
   * Asegura sesión válida para una acción sensible.
   * - Si el usuario CANCELA el login/firmado → retorna false sin limpiar sesión ni toastear.
   * - Si no hay wallet → dispara gate en silencio (sin "expired").
   */
  const ensureReady = async (action, force = false) => {
    if (!force && ensurePromiseRef.current) {
      return ensurePromiseRef.current;
    }
    if (isEnsuring.current) return false;
    isEnsuring.current = true;

    LOG("ensureReady:start", {
      isReady,
      connected,
      hasPublicKey: !!publicKey,
      walletAuthed: stateRef.current.walletAuthed,
      jwtValid: stateRef.current.jwtValid,
      force,
    });

    const executor = (async () => {
      try {
        const liveConnected = !!connected && !!publicKey;
        stateRef.current.walletConnected = liveConnected;

        // 1) Sincroniza status del server si aún no está listo
        if (!isReady) {
          await syncAuthStatus(true);
          LOG("ensureReady:status-synced");
        }

        // 2) Wallet debe estar conectada → NO emitir 'sessionExpired' en frío
        if (!liveConnected) {
          LOG("ensureReady:gate-login (no wallet)");
          setRequiresLogin(true);
          return false;
        }

        // 3) Autenticación con firma si aún no se hizo en esta sesión
        if (!stateRef.current.walletAuthed) {
          try {
            LOG("ensureReady:authenticating wallet…");
            if (!pendingAuthRef.current) {
              pendingAuthRef.current = (async () => {
                try {
                  return await authenticateWallet();
                } finally {
                  pendingAuthRef.current = null;
                }
              })();
            }

            const authResult = await pendingAuthRef.current.catch((err) => {
              pendingAuthRef.current = null;
              throw err;
            });
            LOG("ensureReady:auth result", authResult);
            if (!authResult || authResult.status !== "authenticated") {
              if (isUserCancelError(authResult)) {
                LOG("ensureReady:auth cancelled by user");
                return false;
              }
              await handleAuthFailure("auth_failed");
              return false;
            }
          } catch (e) {
            if (isUserCancelError(e)) {
              LOG("ensureReady:auth cancelled by user (throw)");
              return false;
            }
            await handleAuthFailure("auth_failed");
            return false;
          }

          stateRef.current.walletAuthed = true;
          stateRef.current.jwtValid = true;
          hadAuthedRef.current = true;
          setRequiresLogin(false);
          await syncAuthStatus(true);
          notify("Authentication complete.", "success");
        }

        // 4) Refresh si toca (o si se fuerza)
        if (!stateRef.current.jwtValid || force) {
          LOG("ensureReady:refreshToken start");
          const refreshed = await refreshToken(); // emite 'sessionRefreshed' al éxito
          stateRef.current.jwtValid = !!refreshed;

          if (!refreshed) {
            LOG("ensureReady:refreshToken FAILED");
            await handleAuthFailure("refresh_failed");
            window.dispatchEvent(new CustomEvent("sessionExpired", { detail: { silent: false } }));
            return false;
          }

          LOG("ensureReady:refreshToken OK");
          await syncAuthStatus(true);
        }

        if (typeof action === "function") await action();
        LOG("ensureReady:done OK");
        return true;
      } finally {
        isEnsuring.current = false;
      }
    })();

    if (!force) {
      const sharedPromise = executor.finally(() => {
        if (ensurePromiseRef.current === sharedPromise) ensurePromiseRef.current = null;
      });
      ensurePromiseRef.current = sharedPromise;
      return sharedPromise;
    }

    try {
      return await executor;
    } finally {
      if (ensurePromiseRef.current === executor) ensurePromiseRef.current = null;
    }
  };

  const ensureReadyOnce = useCallback(() => {
    if (ensureOnceRef.current) return ensureOnceRef.current;
    const run = ensureReady();
    ensureOnceRef.current = run.finally(() => {
      ensureOnceRef.current = null;
    });
    return ensureOnceRef.current;
  }, [ensureReady]);

  return {
    isAuthenticated,
    isLoading,
    requiresLogin,
    selectedWallet,          // pubkey normalizada
    pubkey: selectedWallet,  // alias
    isAdmin: serverIsAdmin,
    serverWallet,
    serverRole,
    ensureReady,
    ensureReadyOnce,
    handleAuthFailure,
  };
};
