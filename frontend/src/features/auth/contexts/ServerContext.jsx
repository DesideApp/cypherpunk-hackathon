import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { checkAuthStatus } from "@shared/services/apiService.js";
import { hasSessionTokens } from "@shared/services/tokenService.js";

const ServerContext = createContext();

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer debe usarse dentro de un ServerProvider");
  }
  return context;
};

export const ServerProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState({ wallet: null, role: null, isAdmin: false });
  const lastChecked = useRef(0);
  const checking = useRef(false);
  const lastReset = useRef(0);

  /**
   * 🔹 Sincroniza estado de auth con el backend
   */
  const syncAuthStatus = useCallback(
    async (force = false) => {
      const now = Date.now();

      // Evitar llamadas repetidas en <5s o en paralelo
      if (checking.current || (!force && now - lastChecked.current < 5000)) return;

      try {
        checking.current = true;
        const authStatus = await checkAuthStatus(); // <- normalizado

        // Si devuelve la forma normalizada de "anónimo"
        if (authStatus && authStatus.isAuthenticated === false) {
          setIsAuthenticated(false);
          setUser({ wallet: null, role: null, isAdmin: false });
        } else if (authStatus && authStatus.isAuthenticated === true) {
          setIsAuthenticated(true);
          setUser({
            wallet: authStatus.wallet ?? null,
            role: authStatus.role ?? null,
            isAdmin: !!authStatus.isAdmin,
          });
        } else if (authStatus && authStatus.error === true) {
          // Otros errores → por seguridad, consideramos no autenticado
          console.warn("[ServerContext] /status error:", authStatus);
          setIsAuthenticated(false);
          setUser({ wallet: null, role: null, isAdmin: false });
        }
      } catch (error) {
        console.warn("[ServerContext] ❌ Error comprobando estado de auth:", error);
        setIsAuthenticated(false);
        setUser({ wallet: null, role: null, isAdmin: false });
      } finally {
        setIsReady(true);
        lastChecked.current = now;
        checking.current = false;
      }
    },
    [] // Sin dependencias → estable
  );

  /**
   * 🔹 Resetea el estado global de autenticación (fusible anti-bucle)
   */
  const resetAuth = useCallback(() => {
    const now = Date.now();
    if (now - lastReset.current < 1500) {
      console.warn("⛔ resetAuth ignorado (fusible anti-bucle)");
      return;
    }
    lastReset.current = now;

    setIsAuthenticated(false);
    setIsReady(true);
    setUser({ wallet: null, role: null, isAdmin: false });
    lastChecked.current = 0;
  }, []);

  /**
   * 🔹 Check inicial al montar la app
   */
  useEffect(() => {
    if (hasSessionTokens()) {
      syncAuthStatus(true);
    } else {
      setIsReady(true);
    }
  }, [syncAuthStatus]);

  // 🔄 Al recibir "sessionRefreshed", vuelve a consultar /status
  useEffect(() => {
    const onRefreshed = () => syncAuthStatus(true);
    window.addEventListener("sessionRefreshed", onRefreshed);
    return () => window.removeEventListener("sessionRefreshed", onRefreshed);
  }, [syncAuthStatus]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isReady,
      user,
      isAdmin: user?.isAdmin ?? false,
      wallet: user?.wallet ?? null,
      role: user?.role ?? null,
      syncAuthStatus,
      resetAuth,
    }),
    [isAuthenticated, isReady, user, syncAuthStatus, resetAuth]
  );

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
};

export default ServerProvider;
