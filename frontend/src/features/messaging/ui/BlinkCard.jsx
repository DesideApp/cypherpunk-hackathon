// Componente para mostrar blinks como cards en el chat
// Se integra con el sistema de mensajería para mostrar blinks detectados

import React, { useState, useEffect } from 'react';
import { ExternalLink, Zap, AlertCircle, Play } from 'lucide-react';
import { getBlinkInfo, executeBlink } from '../actions/blink-explorer.jsx';
import './BlinkCard.css';

/**
 * Componente para mostrar un blink como card en el chat
 * @param {Object} props - Props del componente
 * @param {string} props.url - URL del blink
 * @param {Function} props.onExecute - Callback para ejecutar el blink
 * @param {boolean} props.compact - Modo compacto
 */
export function BlinkCard({ url, onExecute, compact = false }) {
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
      // Ejecutar el blink
      executeBlink(url, { method: 'redirect' });
    }
  };

  if (loading) {
    return (
      <div className={`blink-card blink-card--loading ${compact ? 'blink-card--compact' : ''}`}>
        <div className="blink-card__skeleton">
          <div className="blink-card__skeleton-icon"></div>
          <div className="blink-card__skeleton-content">
            <div className="blink-card__skeleton-title"></div>
            <div className="blink-card__skeleton-description"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blinkInfo?.isValid) {
    return (
      <div className={`blink-card blink-card--error ${compact ? 'blink-card--compact' : ''}`}>
        <div className="blink-card__icon">
          <AlertCircle size={16} />
        </div>
        <div className="blink-card__content">
          <div className="blink-card__title">Blink no válido</div>
          <div className="blink-card__description">
            {error || blinkInfo?.error || 'No se pudo cargar la información del blink'}
          </div>
        </div>
      </div>
    );
  }

  const { title, description, image, type } = blinkInfo;

  return (
    <div className={`blink-card blink-card--valid ${compact ? 'blink-card--compact' : ''}`}>
      {image && (
        <div className="blink-card__image">
          <img src={image} alt={title} />
        </div>
      )}
      
      <div className="blink-card__icon">
        <Zap size={16} />
      </div>
      
      <div className="blink-card__content">
        <div className="blink-card__title">{title}</div>
        <div className="blink-card__description">{description}</div>
        {!compact && (
          <div className="blink-card__type">{type}</div>
        )}
      </div>
      
      <div className="blink-card__actions">
        <button 
          className="blink-card__execute"
          onClick={handleExecute}
          title="Ejecutar blink"
        >
          <Play size={14} />
          {!compact && 'Ejecutar'}
        </button>
      </div>
    </div>
  );
}

/**
 * Hook para detectar blinks en texto de mensajes
 * @param {string} text - Texto del mensaje
 * @returns {Object} - Información de blinks detectados
 */
export function useBlinkDetection(text) {
  const [detectedBlinks, setDetectedBlinks] = useState([]);

  useEffect(() => {
    if (!text) {
      setDetectedBlinks([]);
      return;
    }

    // Patrones para detectar URLs de blinks
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
  }, [text]);

  return {
    detectedBlinks,
    hasBlinks: detectedBlinks.length > 0
  };
}

/**
 * Componente para mostrar múltiples blinks en un mensaje
 * @param {Object} props - Props del componente
 * @param {Array} props.urls - Array de URLs de blinks
 * @param {Function} props.onExecute - Callback para ejecutar blinks
 */
export function BlinkList({ urls, onExecute }) {
  if (!urls || urls.length === 0) return null;

  return (
    <div className="blink-list">
      {urls.map((url, index) => (
        <BlinkCard
          key={`${url}-${index}`}
          url={url}
          onExecute={onExecute}
          compact={urls.length > 1}
        />
      ))}
    </div>
  );
}

/**
 * Función para procesar un mensaje y extraer blinks
 * @param {string} message - Texto del mensaje
 * @returns {Object} - Mensaje procesado con blinks extraídos
 */
export function processMessageWithBlinks(message) {
  const { detectedBlinks, hasBlinks } = useBlinkDetection(message);
  
  if (!hasBlinks) {
    return {
      originalMessage: message,
      processedMessage: message,
      blinks: [],
      hasBlinks: false
    };
  }

  // Remover URLs de blinks del texto original para evitar duplicación
  let processedMessage = message;
  detectedBlinks.forEach(url => {
    processedMessage = processedMessage.replace(url, '').trim();
  });

  return {
    originalMessage: message,
    processedMessage,
    blinks: detectedBlinks,
    hasBlinks: true
  };
}

