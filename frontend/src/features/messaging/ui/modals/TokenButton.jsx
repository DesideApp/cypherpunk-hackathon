import React, { useState, useEffect } from "react";
import { getTokenMeta } from "../../config/tokenMeta.js";
import { formatPriceUSD } from "@shared/utils/priceFormatter.js";
import { ActionModalTokenLogo } from "@shared/ui/action-modals/index.js";

/**
 * Token button with automatic color generation
 */
export default function TokenButton({ token, price, onClick, disabled }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const loadMeta = async () => {
      try {
        const tokenMeta = await getTokenMeta(token.code);
        if (mounted) {
          setMeta(tokenMeta);
          setLoading(false);
        }
      } catch (error) {
        console.warn('Failed to load token metadata:', error);
        if (mounted) {
          setMeta({
            code: token.code,
            label: token.code,
            icon: `/tokens/${token.code.toLowerCase()}.png`,
            tint: '#64748b',
            background: 'rgba(148,163,184,0.08)',
            glow: 'rgba(148,163,184,0.18)',
            iconScale: 0.86,
          });
          setLoading(false);
        }
      }
    };
    
    loadMeta();
    
    return () => {
      mounted = false;
    };
  }, [token.code]);
  
  if (loading) {
    return (
      <button
        type="button"
        className="buy-token disabled"
        disabled
        title="Loading token..."
      >
        <div style={{ opacity: 0.5 }}>
          <ActionModalTokenLogo
            icon="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2364748b'/%3E%3C/svg%3E"
            alt="Loading"
            size="medium"
          />
        </div>
        <div className="buy-token-info">
          <div className="buy-token-name">{token.code}</div>
          <div className="buy-token-price">Loading...</div>
        </div>
      </button>
    );
  }
  
  const iconPath = meta.icon || `/tokens/${token.code.toLowerCase()}.png`;
  const iconStyle = {
    ...(meta.tint ? { "--icon-outline": meta.tint } : {}),
    ...(meta.background ? { "--icon-bg": meta.background } : {}),
    ...(meta.glow ? { "--icon-glow": meta.glow } : {}),
  };
  const innerStyle = meta.iconScale ? { "--icon-scale": meta.iconScale } : undefined;
  
  return (
    <button
      type="button"
      className={`buy-token${disabled ? " disabled" : ""}`}
      onClick={() => onClick(token)}
      disabled={disabled}
      title={disabled ? "Token not configured" : `Buy ${token.code}`}
    >
      <ActionModalTokenLogo
        icon={iconPath}
        alt={meta.label || token.code}
        size="medium"
        style={{
          ...iconStyle,
          ...(innerStyle || {})
        }}
      />
      <div className="buy-token-info">
        <div className="buy-token-name">{meta.label || token.code}</div>
        <div className="buy-token-price">
          {formatPriceUSD(price)}
        </div>
      </div>
    </button>
  );
}



