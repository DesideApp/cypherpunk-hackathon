import { useEffect, useState } from 'react';
import { useRpc } from '../contexts/RpcProvider';
import { useWallet } from '../contexts/WalletProvider';
import { asPk } from '../utils/pubkey';

export function useSolanaBalance() {
  const { endpoint } = useRpc();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<string>('—');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!publicKey) {
          if (!cancelled) setBalance('—');
          return;
        }
        const { Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        // Helius: basta con usar su URL con ?api-key=... (devnet o mainnet).
        // Si prefieres más "snap", usa 'processed'. Puedes volver a 'confirmed' si te interesa mayor finality.
        const conn = new Connection(endpoint, 'processed');
        const pk = asPk(publicKey);
        const lamports = await conn.getBalance(pk);
        if (cancelled) return;
        const sol = lamports / LAMPORTS_PER_SOL;
        setBalance(sol.toFixed(4) + ' SOL');
      } catch {
        if (!cancelled) setBalance('—');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint, publicKey]);

  return balance;
}
