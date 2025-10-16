```javascript
import { useWallet } from "@solana/wallet-adapter-react";
import { AUTH_STATUS } from "../constants";
import { panelEvents } from "../events";
import { authenticateWallet } from "../utils";

export const useAuth = () => {
  const { connected, publicKey, disconnect } = useWallet();
  const [status, setStatus] = useState(AUTH_STATUS.LOGGED_OUT);

  const login = async () => {
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
      } catch (e) {
        // ❗ En error también evitamos disconnect/evento para mantener la wallet lista para reintentar
        setStatus(AUTH_STATUS.LOGGED_OUT);
      }
    }
  };

  const logout = async () => {
    try { await disconnect(); } catch {}
    setStatus(AUTH_STATUS.LOGGED_OUT);
    // No emitimos aquí: WalletProvider ya lo hace en disconnect() y en accountChanged → null
  };

  return { status, login, logout };
};
```