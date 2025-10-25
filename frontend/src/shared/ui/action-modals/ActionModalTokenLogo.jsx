import React from 'react';

/**
 * ActionModalTokenLogo - Reusable token logo component with glow effect
 * 
 * Features:
 * - No circular border (clean look)
 * - Token-specific glow from metadata
 * - Hover effect support
 * - Responsive sizing (small, medium, large)
 * 
 * @param {string} icon - Path to token icon image
 * @param {string} alt - Alt text for image
 * @param {object} style - CSS custom properties (--icon-glow, --icon-scale, etc.)
 * @param {string} size - Size variant: 'small' (32px), 'medium' (44px), 'large' (52px)
 * @param {string} className - Additional CSS classes
 */
export function ActionModalTokenLogo({ 
  icon, 
  alt = 'Token', 
  style = {}, 
  size = 'medium',
  className = '' 
}) {
  const classes = [
    'action-modal-token-logo-simple',
    `action-modal-token-logo-simple--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      <img src={icon} alt={alt} />
    </div>
  );
}

