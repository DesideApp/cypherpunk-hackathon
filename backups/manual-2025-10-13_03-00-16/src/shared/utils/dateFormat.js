// src/shared/utils/dateFormat.js
export function formatDate(ts) {
  const d = new Date(typeof ts === "number" ? ts : Number(ts) || Date.now());
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(ts) {
  const d = new Date(typeof ts === "number" ? ts : Number(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
