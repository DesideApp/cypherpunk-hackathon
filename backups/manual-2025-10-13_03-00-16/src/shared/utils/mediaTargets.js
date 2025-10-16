// src/shared/utils/mediaTargets.js
// Cálculo de targets por tipo en base al per-message cap del servidor.
// Ratios heredados del legacy (image 65%, audio 60%, video 70%). :contentReference[oaicite:6]{index=6}

/**
 * remoteCfg:
 * {
 *   globalCapBytes?: number,
 *   defaults?: { perMessageMaxBytes?: number },
 *   overrides?: { perMessageMaxBytes?: number|null } | null
 * }
 *
 * computeMediaTargets(remoteCfg, { quality }):
 *   quality: 'standard' | 'hd'
 *   → { perMsgCap, targets: { image, video, audio } }
 */
export function computeMediaTargets(remoteCfg = {}, { quality = "standard" } = {}) {
  const defaultsCap = remoteCfg?.defaults?.perMessageMaxBytes ?? 3_000_000; // fallback ≈3MB (base64)
  const overrideCap = remoteCfg?.overrides?.perMessageMaxBytes;
  const globalCap   = remoteCfg?.globalCapBytes;

  const perMsgCap = Math.min(
    Number.isFinite(globalCap) ? globalCap : Infinity,
    Number.isFinite(overrideCap) ? overrideCap : defaultsCap
  );

  const ratios =
    quality === "hd"
      ? { image: 0.85, video: 0.90, audio: 0.60 }
      : { image: 0.65, video: 0.70, audio: 0.60 };

  return {
    perMsgCap,
    targets: {
      image: Math.floor(perMsgCap * ratios.image),
      video: Math.floor(perMsgCap * ratios.video),
      audio: Math.floor(perMsgCap * ratios.audio),
    },
  };
}

// Alias compatible con el legacy (mismos porcentajes “standard”)
export function pickTargets(remoteCfg) {
  const { perMsgCap, targets } = computeMediaTargets(remoteCfg, { quality: "standard" });
  return { perMsgCap, targets };
}
