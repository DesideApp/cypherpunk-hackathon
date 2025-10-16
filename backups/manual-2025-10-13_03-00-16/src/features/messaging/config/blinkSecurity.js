const ALLOWED_ORIGINS = new Set([
  "https://solana-sbl.dial.to",
  "https://solana.dial.to",
  "https://jupiter.dial.to",
  "https://api.dial.to",
  "https://phantom.app",
]);

function extractOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (_error) {
    throw new Error(`Invalid URL provided: ${url}`);
  }
}

export function assertAllowed(url, { feature } = {}) {
  const origin = extractOrigin(url);
  if (!ALLOWED_ORIGINS.has(origin)) {
    const label = feature ? `for ${feature}` : "";
    throw new Error(`Blink URL not allowed ${label}: ${origin}`.trim());
  }
}

export { ALLOWED_ORIGINS };
