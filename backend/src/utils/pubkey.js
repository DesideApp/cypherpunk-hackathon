// Utilidades de pubkey (Solana base58 de 32 bytes)
let bs58;
try {
  // si tienes bs58 instalado, mejor
  bs58 = (await import("bs58")).default;
} catch (e) {
  bs58 = null;
}

/**
 * Valida si es una pubkey de Solana (base58 → 32 bytes).
 * Apta para MVP. Para hardening, valida también curva ed25519 si lo deseas.
 */
export function isValidSolanaPubkey(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  // Rechazar strings con chars fuera del alfabeto base58
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(v)) return false;

  if (!bs58) {
    // fallback aproximado: longitud típica 43-44 chars
    return v.length >= 32 && v.length <= 64;
  }
  try {
    const bytes = bs58.decode(v);
    return bytes.length === 32;
  } catch {
    return false;
  }
}
