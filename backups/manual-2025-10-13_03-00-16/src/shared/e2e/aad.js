export function buildAAD({ convId, from, to, isMedia = false }) {
  if (!convId || !from || !to) {
    throw new Error('buildAAD requires convId, from, and to');
  }
  const base = `cid:${convId}|from:${from}|to:${to}|v:1`;
  return isMedia ? `${base}|media` : base;
}

export default buildAAD;
