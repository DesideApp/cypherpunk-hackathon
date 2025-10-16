// src/hooks/useAuthGate.js
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useAuth, AUTH_STATUS } from "@features/auth/contexts/AuthContext.jsx";

export function useAuthGate(openFlag) {
  const { connected, connecting, publicKey } = useWallet();
  const { status } = useAuth();

  const hasPersistence =
    typeof window !== "undefined" && !!localStorage.getItem("lastConnectedWallet");

  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setBootDone(true), 120);
    return () => clearTimeout(id);
  }, []);

  const walletConnected = !!publicKey || connected;
  const isReady = status === AUTH_STATUS.READY;

  const authBusy =
    connecting ||
    status === AUTH_STATUS.CONNECTING ||
    status === AUTH_STATUS.AUTHENTICATING ||
    status === AUTH_STATUS.SWITCHING;

  const isOpen = Boolean(openFlag && bootDone && !authBusy && !isReady && !hasPersistence);

  return useMemo(
    () => ({
      isOpen,
      isBusy: authBusy,
      walletConnected,
      connecting,
    }),
    [isOpen, authBusy, walletConnected, connecting]
  );
}
