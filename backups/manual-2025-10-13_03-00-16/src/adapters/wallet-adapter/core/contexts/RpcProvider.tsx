import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Connection, type Commitment } from '@solana/web3.js';

type RpcContextValue = {
  endpoint: string;
  wsEndpoint?: string;
  commitment: Commitment;
  connection: Connection;
};

const RpcContext = createContext<RpcContextValue | null>(null);

export function RpcProvider({
  children,
  endpoint,
  wsEndpoint,
  commitment = 'confirmed',
}: React.PropsWithChildren<{ endpoint: string; wsEndpoint?: string; commitment?: Commitment }>) {
  // ✅ Conexión memoizada por endpoint/ws/commitment
  const connection = useMemo(
    () => new Connection(endpoint, { wsEndpoint, commitment }),
    [endpoint, wsEndpoint, commitment]
  );

  // (Opcional) cerrar WS al desmontar, por higiene
  useEffect(() => {
    return () => {
      try { (connection as any)?._rpcWebSocket?.close?.(1000, 'RpcProvider unmount'); } catch {}
    };
  }, [connection]);

  const value = useMemo(
    () => ({ endpoint, wsEndpoint, commitment, connection }),
    [endpoint, wsEndpoint, commitment, connection]
  );

  return <RpcContext.Provider value={value}>{children}</RpcContext.Provider>;
}

export function useRpc() {
  const ctx = useContext(RpcContext);
  if (!ctx) throw new Error('useRpc must be used within <RpcProvider>');
  return ctx;
}
