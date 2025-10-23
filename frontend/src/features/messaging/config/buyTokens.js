const WSOL_MINT = "So11111111111111111111111111111111111111112";

function readEnv(key, fallback = null) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
      const v = import.meta.env[key];
      if (v !== undefined) return v;
    }
  } catch (_) {}
  if (typeof window !== "undefined" && window.__ENV__ && key in window.__ENV__) {
    const v = window.__ENV__[key];
    if (v !== undefined) return v;
  }
  if (typeof process !== "undefined" && process.env && key in process.env) {
    const v = process.env[key];
    if (v !== undefined) return v;
  }
  return fallback;
}

const BUY_TOKENS = [
  {
    code: "SOL",
    label: "Solana",
    mintMainnet: WSOL_MINT,
    decimals: 9,
    dialPath: null, // SOL no necesita swap, es nativo
  },
  {
    code: "BONK",
    label: "Bonk",
    mintMainnet: readEnv("VITE_MINT_BONK", null),
    decimals: 5,
    dialPath: "swap/SOL-BONK",
  },
  {
    code: "PENGU",
    label: "Pengu",
    mintMainnet: readEnv("VITE_MINT_PENGU", null),
    decimals: 6,
    dialPath: "swap/SOL-PENGU",
  },
  {
    code: "PUMP",
    label: "Pump",
    mintMainnet: readEnv("VITE_MINT_PUMP", null),
    decimals: 6,
    dialPath: "swap/SOL-PUMP",
  },
  {
    code: "JUP",
    label: "Jupiter",
    mintMainnet: readEnv("VITE_MINT_JUP", null),
    decimals: 6,
    dialPath: "swap/SOL-JUP",
  },
];

function isMainnet(chain) {
  if (!chain) return true;
  const v = String(chain).toLowerCase();
  return v === "mainnet-beta" || v === "mainnet";
}

export function listBuyTokens(chain) {
  const mainnet = isMainnet(chain);
  return BUY_TOKENS.map((t) => ({
    ...t,
    outputMint: mainnet ? t.mintMainnet : t.mintDevnet || null,
    dialToUrl: t.dialPath ? `https://jupiter.dial.to/${t.dialPath}` : null,
  }));
}

export const INPUT_MINT = WSOL_MINT;

export default BUY_TOKENS;
