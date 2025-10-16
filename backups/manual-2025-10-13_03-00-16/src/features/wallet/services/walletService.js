// src/services/walletService.js
import { Transaction, SystemProgram } from "@solana/web3.js";
import { asPk } from "@adapters/wallet-adapter/core/utils/pubkey";

// Convierte SOL (string|number) → lamports sin floats
function toLamports(amount) {
  const [w, f = ""] = String(amount).trim().replace(/,/g, ".").split(".");
  const frac = (f + "000000000").slice(0, 9);
  const s = `${w}${frac}`.replace(/^(-?)0+(?=\d)/, "$1");
  const n = Number(s);
  if (!Number.isSafeInteger(n)) {
    console.error("[WalletService] ❌ toLamports: cantidad inválida:", amount, "→", s);
    throw new Error("Cantidad fuera de rango o no válida");
  }
  return n;
}

/**
 * Envía SOL usando adapter + connection (del RpcProvider)
 */
export const sendTransaction = async ({ fromPubkey, toPubkey, amount }, adapter, connection) => {
  try {
    if (!adapter) throw new Error("Falta adapter (wallet)");
    if (!connection) throw new Error("Falta connection");
    console.debug("[WalletService] sendTransaction input:", { fromPubkey, toPubkey, amount });

    const lamports = toLamports(amount);
    console.debug("[WalletService] lamports calculados:", lamports);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: asPk(fromPubkey),
        toPubkey: asPk(toPubkey),
        lamports,
      })
    );

    const signature = await adapter.sendTransaction(tx, connection);
    console.log("[WalletService] ✅ Transacción enviada:", signature);
    return signature;
  } catch (error) {
    console.error("[WalletService] ❌ Error enviando transacción:", error?.message);
    throw new Error("No se pudo enviar la transacción");
  }
};

// (placeholders que ya tenías, con log)
export const getWalletBalance = async (_pubkey) => {
  console.warn("[WalletService] ⚠️ getWalletBalance aún no implementado (devuelve 0)");
  return 0;
};

export const getTokens = async (_pubkey) => {
  console.warn("[WalletService] ⚠️ getTokens aún no implementado (devuelve [])");
  return [];
};
