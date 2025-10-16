// Renderer para blinks de dial.to
// Componente que renderiza previews de blinks de dial.to

import React from 'react';
import { DialBlinkRenderer as NewDialBlinkRenderer } from './DialBlinkPreview.jsx';

/**
 * Renderer para blinks de dial.to
 * @param {Object} props - Props del renderer
 * @param {Array} props.data - Array de blinks detectados
 * @param {boolean} props.isMe - Si es mensaje propio
 */
export function DialBlinkRenderer({ data, isMe = false }) {
  return <NewDialBlinkRenderer data={data} isMe={isMe} />;
}

