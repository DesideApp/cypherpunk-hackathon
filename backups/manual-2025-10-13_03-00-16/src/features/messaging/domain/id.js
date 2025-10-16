// id.js — helpers de identidad/mensajería

// Normaliza una pubkey (trim básico; aquí podrías añadir checksum si aplica)
export function canonicalWallet(a) {
  return String(a || "").trim();
}

// ConvId determinista ÚNICO: "A:B" (ordenado alfabéticamente)
export function canonicalConvId(a, b) {
  const A = canonicalWallet(a);
  const B = canonicalWallet(b);
  return [A, B].sort().join(":");
}

// Migración de claves legacy "A::B" → "A:B"
export function migrateConvKey(key) {
  if (typeof key !== "string") return key;
  if (key.includes("::")) return key.replace("::", ":");
  return key;
}

// UUID v4 robusto con 3 rutas: crypto.randomUUID → crypto.getRandomValues → Math.random
export function newMsgId() {
  const g = (typeof globalThis !== "undefined" ? globalThis : window);

  // 1) Soporte nativo
  if (g?.crypto?.randomUUID) {
    try { return g.crypto.randomUUID(); } catch {}
  }

  // 2) getRandomValues
  if (g?.crypto?.getRandomValues) {
    try {
      const buf = new Uint8Array(16);
      g.crypto.getRandomValues(buf);
      // RFC 4122 bits
      buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant
      const hex = [...buf].map(b => b.toString(16).padStart(2, "0"));
      return (
        hex.slice(0, 4).join("") + "-" +
        hex.slice(4, 6).join("") + "-" +
        hex.slice(6, 8).join("") + "-" +
        hex.slice(8, 10).join("") + "-" +
        hex.slice(10, 16).join("")
      );
    } catch {}
  }

  // 3) Fallback Math.random (no cripto-seguro)
  const rnd32 = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const s1 = rnd32();
  const s2 = rnd32();
  const s3 = rnd32();
  const s4 = rnd32();
  // Ensambla patrón 8-4-4-4-12 con version/variant aproximados
  return [
    s1,
    s2.slice(0, 4),
    ((parseInt(s3.slice(0, 4), 16) & 0x0fff) | 0x4000).toString(16).padStart(4, "0"),
    ((parseInt(s3.slice(4, 8), 16) & 0x3fff) | 0x8000).toString(16).padStart(4, "0"),
    (s4 + rnd32()).slice(0, 12),
  ].join("-");
}

// ── Compat: expone también `convId` para código antiguo ─────────────────────────
export { canonicalConvId as convId };
