// Componente para mostrar blinks de dial.to como cards en el chat
// Usa los estilos existentes de BlinkActionCard para consistencia

import React, { useState, useEffect } from 'react';
import { ExternalLink, Zap, AlertCircle, Play } from 'lucide-react';
import './DialBlinkCard.css';

/**
 * Componente para mostrar un blink de dial.to como card
 * @param {Object} props - Props del componente
 * @param {string} props.url - URL del blink de dial.to
 * @param {boolean} props.isMe - Si es mensaje propio
 * @param {Function} props.onExecute - Callback para ejecutar el blink
 */
export function DialBlinkCard({ url, isMe = false, onExecute }) {
  const [blinkInfo, setBlinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;

    const loadBlinkInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Extraer información básica de la URL
        const info = extractBlinkInfo(url);
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
      // Ejecutar el blink - por ahora abrir en nueva pestaña
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className={`dial-blink-card-wrapper ${isMe ? 'dial-blink-card-wrapper--own' : 'dial-blink-card-wrapper--contact'}`}>
        <div className={`dial-blink-card ${isMe ? 'dial-blink-card--own' : 'dial-blink-card--contact'}`}>
          <div className="dial-blink-card__skeleton">
            <div className="dial-blink-card__skeleton-icon"></div>
            <div className="dial-blink-card__skeleton-content">
              <div className="dial-blink-card__skeleton-title"></div>
              <div className="dial-blink-card__skeleton-description"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blinkInfo) {
    return (
      <div className={`dial-blink-card-wrapper ${isMe ? 'dial-blink-card-wrapper--own' : 'dial-blink-card-wrapper--contact'}`}>
        <div className={`dial-blink-card dial-blink-card--error ${isMe ? 'dial-blink-card--own' : 'dial-blink-card--contact'}`}>
          <div className="dial-blink-card-header">
            <div className="dial-blink-card-title">Blink no válido</div>
            <div className="dial-blink-card-subtitle">
              {error || 'No se pudo cargar la información del blink'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { title, description, type, action } = blinkInfo;

  return (
    <div className={`dial-blink-card-wrapper ${isMe ? 'dial-blink-card-wrapper--own' : 'dial-blink-card-wrapper--contact'}`}>
      <div className={`dial-blink-card ${isMe ? 'dial-blink-card--own' : 'dial-blink-card--contact'}`}>
        <div className="dial-blink-card-header">
          <div className="dial-blink-card-heading">
            <div className="dial-blink-card-title">{title}</div>
            <div className="dial-blink-card-chip">{type}</div>
          </div>
          <div className="dial-blink-card-subtitle">{description}</div>
        </div>
        
        <div className="dial-blink-card-footer">
          <button 
            className="dial-blink-card-primary"
            onClick={handleExecute}
            title="Ejecutar blink"
          >
            {action || 'Ejecutar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Extrae información básica de una URL de dial.to
 * @param {string} url - URL del blink
 * @returns {Object} - Información extraída
 */
function extractBlinkInfo(url) {
  try {
    // Parsear la URL de dial.to
    const urlObj = new URL(url);
    const actionParam = urlObj.searchParams.get('action');
    
    if (!actionParam) {
      throw new Error('No se encontró parámetro action');
    }

    // Decodificar el solana-action URL
    const solanaActionUrl = decodeURIComponent(actionParam);
    const actualUrl = solanaActionUrl.replace('solana-action:', '');
    
    // Extraer información del URL real
    const actualUrlObj = new URL(actualUrl);
    const pathname = actualUrlObj.pathname;
    
    // Detectar tipo de acción
    let type = 'action';
    let title = 'Blink Action';
    let description = 'Acción de Solana';
    let action = 'Ejecutar';
    
    if (pathname.includes('swap')) {
      type = 'swap';
      title = 'Intercambio de Tokens';
      description = 'Intercambia tokens en Jupiter';
      action = 'Intercambiar';
    } else if (pathname.includes('transfer')) {
      type = 'transfer';
      title = 'Transferencia';
      description = 'Envía tokens';
      action = 'Enviar';
    } else if (pathname.includes('stake')) {
      type = 'stake';
      title = 'Staking';
      description = 'Stake tokens';
      action = 'Stakear';
    } else if (pathname.includes('nft')) {
      type = 'nft';
      title = 'NFT';
      description = 'Acción con NFT';
      action = 'Ejecutar';
    }
    
    return {
      url: actualUrl,
      title,
      description,
      type,
      action,
      domain: actualUrlObj.hostname
    };
  } catch (error) {
    throw new Error(`Error procesando URL: ${error.message}`);
  }
}

/**
 * Detecta si una URL es de dial.to
 * @param {string} url - URL a verificar
 * @returns {boolean} - True si es de dial.to
 */
export function isDialToUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('dial.to');
  } catch {
    return false;
  }
}

/**
 * Extrae URLs de dial.to de un texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Array de URLs de dial.to encontradas
 */
export function extractDialToUrls(text) {
  if (!text) return [];
  
  const dialToPattern = /https?:\/\/[^\s]*dial\.to\/[^\s]*/gi;
  const matches = text.match(dialToPattern) || [];
  
  return [...new Set(matches)]; // Remove duplicates
}
