// Sistema modular de previews para mensajes de texto
// Registry centralizado de detectores y renderers

import { detectDialBlinks } from './detectors/dialBlinkDetector.js';
import { DialBlinkRenderer } from './renderers/DialBlinkRenderer.jsx';

/**
 * Registry de tipos de preview disponibles
 * Cada tipo tiene un detector y un renderer
 */
export const PREVIEW_REGISTRY = {
  'dial-blink': {
    detector: detectDialBlinks,
    renderer: DialBlinkRenderer,
    name: 'Dial Blink',
    description: 'Previews de blinks de dial.to'
  }
  // Futuro: añadir más tipos aquí
  // 'youtube': { detector: detectYouTube, renderer: YouTubeRenderer },
  // 'twitter': { detector: detectTwitter, renderer: TwitterRenderer },
  // 'generic': { detector: detectGeneric, renderer: GenericRenderer }
};

/**
 * Detecta todos los tipos de previews en un texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Array de previews detectados
 */
export async function detectAllPreviews(text) {
  if (!text || typeof text !== 'string') return [];
  
  const previews = [];
  
  // Iterar sobre todos los tipos registrados
  for (const [type, config] of Object.entries(PREVIEW_REGISTRY)) {
    try {
      const detected = await config.detector(text);
      if (detected && detected.length > 0) {
        previews.push({
          type,
          data: detected,
          config
        });
      }
    } catch (error) {
      console.warn(`Error detecting ${type} previews:`, error);
    }
  }
  
  return previews;
}

/**
 * Procesa un texto y extrae previews
 * @param {string} text - Texto original
 * @param {boolean} isMe - Si es mensaje propio
 * @returns {Object} - Texto procesado y previews renderizados
 */
export async function processTextWithPreviews(text, isMe = false) {
  if (!text || typeof text !== 'string') {
    return {
      processedText: text,
      previews: [],
      hasPreviews: false
    };
  }
  
  // Detectar todos los previews
  const detectedPreviews = await detectAllPreviews(text);
  
  if (detectedPreviews.length === 0) {
    return {
      processedText: text,
      previews: [],
      hasPreviews: false
    };
  }
  
  // Procesar texto removiendo URLs de previews
  let processedText = text;
  const allUrls = [];
  
  detectedPreviews.forEach(preview => {
    if (Array.isArray(preview.data)) {
      preview.data.forEach(blink => {
        if (blink.info && blink.info.originalUrl) {
          allUrls.push(blink.info.originalUrl);
        } else if (blink.url) {
          allUrls.push(blink.url);
        }
      });
    } else {
      allUrls.push(preview.data);
    }
  });
  
  // Remover URLs del texto
  allUrls.forEach(url => {
    processedText = processedText.replace(url, '').trim();
  });
  
  // Limpiar espacios múltiples
  processedText = processedText.replace(/\s+/g, ' ').trim();
  
  // Renderizar previews
  const renderedPreviews = detectedPreviews.map(preview => ({
    type: preview.type,
    component: preview.config.renderer,
    data: preview.data,
    isMe
  }));
  
  return {
    processedText,
    previews: renderedPreviews,
    hasPreviews: true,
    originalText: text
  };
}

/**
 * Obtiene información de un tipo de preview
 * @param {string} type - Tipo de preview
 * @returns {Object|null} - Información del tipo
 */
export function getPreviewTypeInfo(type) {
  return PREVIEW_REGISTRY[type] || null;
}

/**
 * Lista todos los tipos de preview disponibles
 * @returns {Array} - Lista de tipos disponibles
 */
export function getAvailablePreviewTypes() {
  return Object.entries(PREVIEW_REGISTRY).map(([type, config]) => ({
    type,
    name: config.name,
    description: config.description
  }));
}

/**
 * Registra un nuevo tipo de preview
 * @param {string} type - Tipo de preview
 * @param {Object} config - Configuración (detector, renderer, name, description)
 */
export function registerPreviewType(type, config) {
  if (!config.detector || !config.renderer) {
    throw new Error('Preview type must have detector and renderer');
  }
  
  PREVIEW_REGISTRY[type] = {
    name: config.name || type,
    description: config.description || `Preview type: ${type}`,
    detector: config.detector,
    renderer: config.renderer
  };
}
