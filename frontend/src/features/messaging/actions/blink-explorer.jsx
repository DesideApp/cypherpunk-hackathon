// Blink Explorer - Sistema para detectar y mostrar previews de blinks
// Permite visualizar cualquier blink que se pase por el chat

import { isAllowedBlink } from './blinkUrlBuilder.js';

/**
 * Obtiene información de un blink desde su URL
 * @param {string} blinkUrl - URL del blink
 * @returns {Object} - Información del blink
 */
export async function getBlinkInfo(blinkUrl) {
  try {
    // Limpiar y normalizar la URL
    const cleanUrl = normalizeBlinkUrl(blinkUrl);
    
    // Verificar si es un blink permitido
    if (!isAllowedBlink(cleanUrl)) {
      throw new Error('Blink no permitido por seguridad');
    }
    
    // Intentar obtener metadata del blink
    const metadata = await fetchBlinkMetadata(cleanUrl);
    
    return {
      url: cleanUrl,
      title: metadata.title || 'Blink Action',
      description: metadata.description || 'Acción de Solana',
      image: metadata.image || null,
      type: detectBlinkType(cleanUrl),
      isValid: true,
      metadata
    };
  } catch (error) {
    return {
      url: blinkUrl,
      title: 'Blink',
      description: 'Acción de Solana',
      image: null,
      type: 'unknown',
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Normaliza una URL de blink
 * @param {string} url - URL a normalizar
 * @returns {string} - URL normalizada
 */
function normalizeBlinkUrl(url) {
  // Si es un solana-action URL, extraer la URL real
  if (url.startsWith('solana-action:')) {
    return url.replace('solana-action:', '');
  }
  
  // Si es una URL de dial.to, extraer la acción
  if (url.includes('dial.to/?action=')) {
    const match = url.match(/action=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]).replace('solana-action:', '');
    }
  }
  
  return url;
}

/**
 * Detecta el tipo de blink basado en la URL
 * @param {string} url - URL del blink
 * @returns {string} - Tipo de blink
 */
function detectBlinkType(url) {
  if (url.includes('transfer')) return 'transfer';
  if (url.includes('swap')) return 'swap';
  if (url.includes('stake')) return 'stake';
  if (url.includes('nft')) return 'nft';
  if (url.includes('dao')) return 'dao';
  return 'action';
}

/**
 * Intenta obtener metadata del blink
 * @param {string} url - URL del blink
 * @returns {Object} - Metadata del blink
 */
async function fetchBlinkMetadata(url) {
  try {
    // Intentar obtener metadata desde el endpoint del blink
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Timeout corto para no bloquear
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || data.name,
        description: data.description,
        image: data.image || data.icon,
        ...data
      };
    }
  } catch (error) {
    console.log('No se pudo obtener metadata del blink:', error.message);
  }
  
  // Fallback: generar metadata básica
  return generateBasicMetadata(url);
}

/**
 * Genera metadata básica basada en la URL
 * @param {string} url - URL del blink
 * @returns {Object} - Metadata básica
 */
function generateBasicMetadata(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  
  // Extraer información básica de la URL
  const title = pathname.split('/').pop() || 'Blink Action';
  const description = `Acción de Solana: ${title}`;
  
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description,
    image: null
  };
}

/**
 * Ejecuta un blink sin abrir externamente
 * @param {string} blinkUrl - URL del blink
 * @param {Object} options - Opciones de ejecución
 */
export function executeBlink(blinkUrl, options = {}) {
  const { 
    method = 'redirect', // 'redirect', 'iframe', 'modal'
    target = '_blank'
  } = options;
  
  switch (method) {
    case 'redirect':
      // Redirigir a dial.to pero manteniendo el contexto
      window.open(blinkUrl, target, 'noopener,noreferrer');
      break;
      
    case 'iframe':
      // Abrir en iframe (más complejo, requiere manejo de CORS)
      console.log('Iframe method not implemented yet');
      break;
      
    case 'modal':
      // Abrir en modal (más complejo, requiere integración completa)
      console.log('Modal method not implemented yet');
      break;
      
    default:
      window.open(blinkUrl, target, 'noopener,noreferrer');
  }
}

/**
 * Hook para manejar blinks en el chat
 * @param {Function} onBlinkDetected - Callback cuando se detecta un blink
 * @returns {Object} - Funciones para manejar blinks
 */
export function useBlinkExplorer(onBlinkDetected) {
  const processBlink = async (url) => {
    try {
      const blinkInfo = await getBlinkInfo(url);
      onBlinkDetected?.(blinkInfo);
      return blinkInfo;
    } catch (error) {
      console.error('Error procesando blink:', error);
      return null;
    }
  };
  
  const executeBlink = (url) => {
    // Por ahora, abrir en nueva pestaña
    // En el futuro, podemos implementar iframe/modal
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  return {
    processBlink,
    executeBlink
  };
}