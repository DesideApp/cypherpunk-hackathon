// Componente para mostrar previews de blinks en el chat
// Se integra con el sistema de mensajería existente

import React, { useState, useEffect } from 'react';
import { ExternalLink, Zap, AlertCircle } from 'lucide-react';
import { getBlinkInfo } from '../actions/blink-explorer.jsx';
import './BlinkPreview.css';

/**
 * Componente para mostrar preview de un blink
 * @param {Object} props - Props del componente
 * @param {string} props.url - URL del blink
 * @param {Function} props.onExecute - Callback para ejecutar el blink
 * @param {boolean} props.compact - Modo compacto para el chat
 */
export function BlinkPreview({ url, onExecute, compact = false }) {
  const [blinkInfo, setBlinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;

    const loadBlinkInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const info = await getBlinkInfo(url);
        setBlinkInfo(info);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBlinkInfo();
  }, [url]);

  const handleExecute = () => {
    if (onExecute) {
      onExecute(url);
    } else {
      // Fallback: abrir en nueva pestaña
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className={`blink-preview blink-preview--loading ${compact ? 'blink-preview--compact' : ''}`}>
        <div className="blink-preview__skeleton">
          <div className="blink-preview__skeleton-icon"></div>
          <div className="blink-preview__skeleton-content">
            <div className="blink-preview__skeleton-title"></div>
            <div className="blink-preview__skeleton-description"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blinkInfo?.isValid) {
    return (
      <div className={`blink-preview blink-preview--error ${compact ? 'blink-preview--compact' : ''}`}>
        <div className="blink-preview__icon">
          <AlertCircle size={16} />
        </div>
        <div className="blink-preview__content">
          <div className="blink-preview__title">Blink no válido</div>
          <div className="blink-preview__description">
            {error || blinkInfo?.error || 'No se pudo cargar la información del blink'}
          </div>
        </div>
      </div>
    );
  }

  const { title, description, image, type } = blinkInfo;

  return (
    <div className={`blink-preview blink-preview--valid ${compact ? 'blink-preview--compact' : ''}`}>
      {image && (
        <div className="blink-preview__image">
          <img src={image} alt={title} />
        </div>
      )}
      
      <div className="blink-preview__icon">
        <Zap size={16} />
      </div>
      
      <div className="blink-preview__content">
        <div className="blink-preview__title">{title}</div>
        <div className="blink-preview__description">{description}</div>
        {!compact && (
          <div className="blink-preview__type">{type}</div>
        )}
      </div>
      
      <div className="blink-preview__actions">
        <button 
          className="blink-preview__execute"
          onClick={handleExecute}
          title="Ejecutar blink"
        >
          <ExternalLink size={14} />
          {!compact && 'Ejecutar'}
        </button>
      </div>
    </div>
  );
}

/**
 * Hook para detectar y procesar blinks en texto
 * @param {string} text - Texto a analizar
 * @param {Function} onBlinkDetected - Callback cuando se detecta un blink
 * @returns {Object} - Información de blinks detectados
 */
export function useBlinkDetection(text, onBlinkDetected) {
  const [detectedBlinks, setDetectedBlinks] = useState([]);

  useEffect(() => {
    if (!text) {
      setDetectedBlinks([]);
      return;
    }

    // Detectar URLs de blinks
    const blinkUrlPatterns = [
      /https?:\/\/[^\s]+\.dial\.to\/[^\s]*/gi,
      /https?:\/\/[^\s]*solana\.dial\.to\/[^\s]*/gi,
      /solana-action:[^\s]+/gi,
    ];
    
    const urls = [];
    for (const pattern of blinkUrlPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        urls.push(...matches);
      }
    }
    
    const uniqueUrls = [...new Set(urls)];
    setDetectedBlinks(uniqueUrls);
    
    // Notificar blinks detectados (sin incluir en dependencias para evitar loop)
    if (uniqueUrls.length > 0 && onBlinkDetected) {
      onBlinkDetected(uniqueUrls);
    }
  }, [text]); // Removido onBlinkDetected de las dependencias

  return {
    detectedBlinks,
    hasBlinks: detectedBlinks.length > 0
  };
}

/**
 * Componente para mostrar múltiples blinks
 * @param {Object} props - Props del componente
 * @param {Array} props.urls - Array de URLs de blinks
 * @param {Function} props.onExecute - Callback para ejecutar blinks
 */
export function BlinkList({ urls, onExecute }) {
  if (!urls || urls.length === 0) return null;

  return (
    <div className="blink-list">
      {urls.map((url, index) => (
        <BlinkPreview
          key={`${url}-${index}`}
          url={url}
          onExecute={onExecute}
          compact={urls.length > 1}
        />
      ))}
    </div>
  );
}




