import { useEffect, useState, useRef, useMemo } from "react";
import { getSolanaStatus, getSolanaTPS, getSolanaPrice } from "@shared/services/solanaService.js";

const useSolanaData = () => {
  // Estados principales
  const [status, setStatus] = useState("offline");
  const [tps, setTps] = useState(0);
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [priceClass, setPriceClass] = useState("neutral");
  const [error, setError] = useState(null);

  // Refs de control
  const priceRef = useRef(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(false);

  // Función que llama a los endpoints
  const fetchData = async () => {
    if (!isMountedRef.current) return;

    try {
      const [statusData, tpsData, priceData] = await Promise.all([
        getSolanaStatus(),
        getSolanaTPS(),
        getSolanaPrice(),
      ]);

      if (!isMountedRef.current) return;

      // Estado red
      setStatus(statusData || "offline");
      setTps(typeof tpsData === "number" ? tpsData : 0);

      // Precio
      if (typeof priceData === "number" && priceData > 0) {
        if (priceRef.current !== null) setPrevPrice(priceRef.current);
        priceRef.current = priceData;
        setPrice(priceData);
      }

      // Reset de errores
      setError(null);
    } catch (error) {
      console.error("❌ Error obteniendo datos de Solana:", error);
      if (isMountedRef.current) {
        setError("🔴 Error obteniendo datos.");
        setStatus("offline");
        setTps(0);
      }
    }
  };

  // Efecto inicial + interval
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
  }, []);

  // Determinar clase de precio (up/down)
  useEffect(() => {
    if (prevPrice === null || price === null) {
      setPriceClass("neutral");
      return;
    }

    const newClass = price > prevPrice ? "up" : price < prevPrice ? "down" : "neutral";
    setPriceClass(newClass);

    const timer = setTimeout(() => setPriceClass("neutral"), 500);
    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  // Valores derivados
  const formattedTps = useMemo(() => {
    if (tps >= 1000) return `${(tps / 1000).toFixed(1)}k`;
    return `${tps.toFixed(0)}`;
  }, [tps]);

  return {
    status,        // Estado de red
    tps,           // TPS crudos
    error,         // Error de red si lo hay
    formattedTps,  // TPS formateados
    price,         // Precio crudo
    priceClass     // Clase de precio (up/down/neutral)
  };
};

export default useSolanaData;
