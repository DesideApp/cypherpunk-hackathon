import { useEffect, useState, useCallback, useRef } from "react";
import { getSolanaStatus, getSolanaTPS } from "@features/wallet/services/solanaService.js";

const useNetworkStatus = () => {
  const [status, setStatus] = useState("offline");
  const [tps, setTps] = useState(0);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const [statusData, tpsData] = await Promise.all([
        getSolanaStatus(),
        getSolanaTPS(),
      ]);
      if (isMountedRef.current) {
        setStatus(statusData || "offline");
        setTps(typeof tpsData === "number" ? tpsData : 0);
        setError(null);
      }
    } catch (error) {
      console.error("❌ Error obteniendo estado de la red:", error);
      if (isMountedRef.current) {
        setError("🔴 Error obteniendo datos.");
        setStatus("offline");
        setTps(0);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    if (!intervalRef.current) {
      intervalRef.current = setInterval(fetchData, 30000);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  return { status, tps, error };
};

export default useNetworkStatus;
