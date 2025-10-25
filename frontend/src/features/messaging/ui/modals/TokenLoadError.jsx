import React from 'react';

/**
 * Error state component when tokens cannot be loaded
 * @param {object} props
 * @param {function} props.onRetry - Callback to retry loading tokens
 * @param {string} props.error - Error message (optional)
 */
export default function TokenLoadError({ onRetry, error }) {
  return (
    <div className="buy-error-state">
      <div className="buy-error-icon">⚠️</div>
      <h3 className="buy-error-title">No se pudieron cargar los tokens</h3>
      <p className="buy-error-message">
        {error || 'Hubo un problema al conectar con el servidor. Por favor, intenta de nuevo.'}
      </p>
      <button 
        className="buy-error-retry"
        onClick={onRetry}
        type="button"
      >
        🔄 Reintentar
      </button>
      <p className="buy-error-hint">
        Si el problema persiste, recarga la página o contacta con soporte.
      </p>
    </div>
  );
}

