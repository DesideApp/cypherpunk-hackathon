// Componente base para renderizar previews
// Usa el registry para renderizar el tipo correcto

import React from 'react';
import { PREVIEW_REGISTRY } from './index.js';

/**
 * Componente base para renderizar previews
 * @param {Object} props - Props del componente
 * @param {string} props.type - Tipo de preview
 * @param {*} props.data - Datos del preview
 * @param {boolean} props.isMe - Si es mensaje propio
 * @param {Object} props.config - Configuración adicional
 */
export function PreviewCard({ type, data, isMe = false, config = {} }) {
  // Obtener configuración del tipo
  const typeConfig = PREVIEW_REGISTRY[type];
  
  if (!typeConfig) {
    console.warn(`Preview type "${type}" not found in registry`);
    return null;
  }
  
  // Obtener el renderer
  const Renderer = typeConfig.renderer;
  
  if (!Renderer) {
    console.warn(`No renderer found for preview type "${type}"`);
    return null;
  }
  
  // Renderizar el preview
  return (
    <Renderer
      data={data}
      isMe={isMe}
      config={config}
      type={type}
    />
  );
}

/**
 * Componente para renderizar múltiples previews
 * @param {Object} props - Props del componente
 * @param {Array} props.previews - Array de previews a renderizar
 * @param {boolean} props.isMe - Si es mensaje propio
 */
export function PreviewList({ previews, isMe = false }) {
  if (!previews || !Array.isArray(previews) || previews.length === 0) {
    return null;
  }
  
  return (
    <div className="preview-list">
      {previews.map((preview, index) => (
        <PreviewCard
          key={`${preview.type}-${index}`}
          type={preview.type}
          data={preview.data}
          isMe={isMe}
          config={preview.config}
        />
      ))}
    </div>
  );
}

/**
 * Hook para renderizar previews
 * @param {Array} previews - Array de previews
 * @param {boolean} isMe - Si es mensaje propio
 * @returns {JSX.Element} - Componente renderizado
 */
export function usePreviewRenderer(previews, isMe = false) {
  return <PreviewList previews={previews} isMe={isMe} />;
}

