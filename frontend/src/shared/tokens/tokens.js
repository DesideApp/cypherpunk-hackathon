/**
 * Token validation config
 * 
 * ⚠️ IMPORTANT: This file is ONLY for validation and UI formatting.
 * It does NOT define which tokens are available for purchase.
 * Token availability is determined by backend/config/tokens.json
 * 
 * Add tokens here as they are added to production (tokens.json)
 */
const TOKENS = {
  SOL: {
    symbol: "SOL",
    decimals: 9,
    ui: { min: 2, max: 6 },
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
    ui: { min: 2, max: 2 },
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    ui: { min: 2, max: 2 },
  },
  BONK: {
    symbol: "BONK",
    decimals: 5,
    ui: { min: 0, max: 2 },
  },
  JUP: {
    symbol: "JUP",
    decimals: 6,
    ui: { min: 0, max: 2 },
  },
  JitoSOL: {
    symbol: "JitoSOL",
    decimals: 9,
    ui: { min: 2, max: 6 },
  },
  POPCAT: {
    symbol: "POPCAT",
    decimals: 9,
    ui: { min: 0, max: 2 },
  },
  ORCA: {
    symbol: "ORCA",
    decimals: 6,
    ui: { min: 0, max: 2 },
  },
};

const DECIMAL_RE = /^\d+(?:\.\d+)?$/;

export function isSupportedToken(token) {
  if (!token) return false;
  return Object.prototype.hasOwnProperty.call(TOKENS, String(token).toUpperCase());
}

export function listSupportedTokens() {
  return Object.keys(TOKENS).map((code) => ({ code, ...TOKENS[code] }));
}

function clampDecimals(token, _value) {
  const { ui } = TOKENS[token];
  const display = parseFloat(_value);
  const [, fraction = ""] = String(display).split(".");
  const whole = Math.floor(display);
  const trimmedFraction = fraction.slice(0, ui.max);
  if (trimmedFraction.length === 0) {
    return whole;
  }
  const normalizedFraction = trimmedFraction.replace(/0+$/, "");
  if (normalizedFraction.length === 0 && ui.min === 0) {
    return whole;
  }
  if (normalizedFraction.length === 0) {
    return `${whole}.${trimmedFraction.padEnd(ui.min, "0")}`;
  }
  const padded = normalizedFraction.padEnd(Math.max(normalizedFraction.length, ui.min), "0");
  return `${whole}.${padded}`;
}

export function validateAmount(token, rawAmount) {
  const upperToken = String(token || "").toUpperCase();
  if (!isSupportedToken(upperToken)) {
    return { ok: false, reason: `Unsupported token ${token}` };
  }

  const input = String(rawAmount || "").trim();
  if (!input) {
    return { ok: false, reason: "Amount required" };
  }
  const normalized = input.replace(/,/g, ".");
  if (!DECIMAL_RE.test(normalized)) {
    return { ok: false, reason: "Amount must be numeric" };
  }
  if (normalized.startsWith("0") && normalized !== "0" && !normalized.startsWith("0.")) {
    const trimmed = normalized.replace(/^0+/, "");
    return validateAmount(upperToken, trimmed);
  }

  const [_whole, fraction = ""] = normalized.split(".");
  const decimals = fraction.length;
  const allowed = TOKENS[upperToken].ui.max;
  if (decimals > allowed) {
    return { ok: false, reason: `Amount supports at most ${allowed} decimals` };
  }

  return { ok: true, value: normalized, token: upperToken };
}

export function normalizeAmount(rawAmount, token) {
  const upperToken = String(token || "").toUpperCase();
  if (!isSupportedToken(upperToken)) {
    throw new Error(`Unsupported token ${token}`);
  }
  const amountStr = String(rawAmount || "").trim().replace(/,/g, ".");
  if (!amountStr) {
    throw new Error("Amount required");
  }
  if (!DECIMAL_RE.test(amountStr)) {
    throw new Error("Amount must be numeric");
  }
  return clampDecimals(upperToken, amountStr);
}

export function formatAmountForDisplay(token, amount) {
  const upperToken = String(token || "").toUpperCase();
  if (!isSupportedToken(upperToken)) return amount;
  const { symbol, ui } = TOKENS[upperToken];
  const number = Number(amount);
  if (!Number.isFinite(number)) return `${amount} ${symbol}`;
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: ui.min,
    maximumFractionDigits: ui.max,
  }).format(number)} ${symbol}`;
}

export { TOKENS };
