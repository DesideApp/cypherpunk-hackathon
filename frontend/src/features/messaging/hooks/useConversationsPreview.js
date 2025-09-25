// src/features/messaging/hooks/useConversationsPreview.js
// Lee el store de mensajería para derivar previews por conversación:
// - último mensaje (texto/etiqueta media)
// - timestamp del último mensaje
// - typing remoto y presencia
// No toca lógica de envío; sólo observa el estado existente.

import { useEffect, useMemo, useState } from "react";
import { subscribe, getState } from "@features/messaging/store/messagesStore.js";

function pickPeerFromConvId(convId, selfWallet) {
  if (!convId || !selfWallet) return null;
  try {
    const [a, b] = String(convId).split(":");
    return a === String(selfWallet) ? b : a;
  } catch {
    return null;
  }
}

function kindLabel(m) {
  try {
    const k = m?.kind || (m?.media ? 'media' : null);
    const mime = m?.mime || m?.media?.mime || '';
    if (k === 'text' || typeof m?.text === 'string') return m.text || '';
    if (k === 'media' || k === 'media-inline') {
      if (mime.startsWith('image/')) return '📷 Photo';
      if (mime.startsWith('video/')) return '🎥 Video';
      if (mime.startsWith('audio/')) return '🎵 Audio';
      return '📎 Attachment';
    }
    return (typeof m?.text === 'string') ? m.text : '';
  } catch {
    return '';
  }
}

function pickTimestamp(m) {
  return (
    m?.timestamp || m?.sentAt || m?.createdAt || null
  );
}

export default function useConversationsPreview(selfWallet) {
  const [snap, setSnap] = useState(() => getState());

  useEffect(() => {
    const off = subscribe((s) => setSnap(s));
    return off;
  }, []);

  return useMemo(() => {
    const items = [];
    const byConv = snap?.byConversation || {};
    for (const convId of Object.keys(byConv)) {
      const list = byConv[convId] || [];
      if (!Array.isArray(list) || list.length === 0) continue;
      const last = list[list.length - 1];
      const chatId = pickPeerFromConvId(convId, selfWallet) || null;
      const text = kindLabel(last);
      const ts = pickTimestamp(last);
      const typing = !!snap?.typing?.[convId];
      const online = chatId ? !!snap?.presence?.[chatId] : false;
      items.push({ chatId, convId, lastMessageText: text, lastMessageTimestamp: ts, typing, online });
    }
    // Orden descendente por ts
    items.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    return items;
  }, [snap, selfWallet]);
}

