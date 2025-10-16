import { STORAGE_NS } from "@shared/config/env.js";

const KEY = `${STORAGE_NS}:recentConversations_v1`;
const MAX_ITEMS = 30;

export function loadRecent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecent({
  chatId,
  lastMessageText = "",
  lastMessageTimestamp = Date.now(),
  displayName = null,
  avatar = null,
}) {
  if (!chatId) return;
  try {
    const list = loadRecent().filter(item => item && item.chatId && item.chatId !== chatId);
    list.unshift({ chatId, lastMessageText, lastMessageTimestamp, displayName, avatar });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota errors */
  }
}
