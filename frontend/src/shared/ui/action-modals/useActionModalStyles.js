const DEFAULTS = {
  tint: "rgba(59,130,246,0.7)",
  glow: "rgba(59,130,246,0.12)",
  background: "rgba(255,255,255,0.05)",
  iconScale: 0.86,
  icon: null,
};

/**
 * Map token metadata (tint, glow, background, icon) to CSS custom properties.
 * The styles are consumed by action modal components to keep parity with Buy.
 */
export function useActionModalStyles(meta) {
  if (!meta) {
    return {
      cardStyle: undefined,
      logoStyle: undefined,
      logoInnerStyle: undefined,
      icon: DEFAULTS.icon,
    };
  }

  const tint = meta.tint || DEFAULTS.tint;
  const glow = meta.glow || DEFAULTS.glow;
  const background = meta.background || DEFAULTS.background;
  const iconScale =
    typeof meta.iconScale === "number" ? meta.iconScale : DEFAULTS.iconScale;

  return {
    cardStyle: {
      "--card-accent": tint,
      "--card-sheen": glow,
      "--card-glow": glow,
      "--card-bg": background,
    },
    logoStyle: {
      "--icon-outline": tint,
      "--icon-bg": background,
      "--icon-glow": glow,
    },
    logoInnerStyle: {
      "--icon-scale": iconScale,
    },
    icon: meta.icon || null,
  };
}

