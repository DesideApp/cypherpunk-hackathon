// Preview de blink de dial.to con estilos de PaymentRequestCard
// Componente compacto y profesional

import React from 'react';
import '../DialBlinkPreview.css';

/**
 * Preview de blink de dial.to
 * @param {Object} props - Props del componente
 * @param {Object} props.blink - Datos del blink
 * @param {boolean} props.isMe - Si es mensaje propio
 */
export function DialBlinkPreview({ blink, isMe = false }) {
  if (!blink || !blink.info) {
    return null;
  }

  const {
    title,
    description,
    image,
    originalUrl,
    siteName,
    domain,
    imageVariant,
  } = blink.info;

  const rootClassName = [
    'dial-blink-preview',
    isMe ? 'dial-blink-preview--sent' : 'dial-blink-preview--received',
  ].join(' ');

  const displayUrl = originalUrl.replace(/^https?:\/\//, '');

  const handleView = () => {
    window.open(originalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCardKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleView();
    }
  };

  return (
    <div className={rootClassName}>
      <a
        className="dial-blink-preview__url"
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={originalUrl}
      >
        {displayUrl}
      </a>

      <div
        className={`dial-blink-preview__card dial-blink-preview__card--${imageVariant || 'landscape'}`}
        onClick={handleView}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Abrir blink ${title}`}
      >
        <div className="dial-blink-preview__card-content">
          <div className="dial-blink-preview__title">{title}</div>
          <div className="dial-blink-preview__domain">{siteName || domain || 'dial.to'}</div>
          {description && (
            <div className="dial-blink-preview__description">{description}</div>
          )}
        </div>

        {image && (
          <div className={`dial-blink-preview__media dial-blink-preview__media--${imageVariant || 'landscape'}`}>
            <img
              src={image}
              alt={title}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renderer para múltiples blinks de dial.to
 * @param {Object} props - Props del renderer
 * @param {Array} props.data - Array de blinks detectados
 * @param {boolean} props.isMe - Si es mensaje propio
 */
export function DialBlinkRenderer({ data, isMe = false }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
    <div className="dial-blink-previews">
      {data.map((blink, index) => (
        <DialBlinkPreview
          key={`${blink.url}-${index}`}
          blink={blink}
          isMe={isMe}
        />
      ))}
    </div>
  );
}
