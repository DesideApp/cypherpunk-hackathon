const signalingData = new Map();
const SIGNAL_TTL = 5 * 60 * 1000;

/**
 * ✅ Almacenar una señal
 */
export const setSignal = (pubkey, data) => {
  const expirationTime = Date.now() + SIGNAL_TTL;
  signalingData.set(pubkey, { data, expirationTime });
  console.log(`📡 Señal almacenada para ${pubkey} hasta ${new Date(expirationTime).toLocaleTimeString()}`);
};

/**
 * ✅ Recuperar una señal
 */
export const getSignal = (pubkey) => {
  const signal = signalingData.get(pubkey);
  if (!signal || signal.expirationTime < Date.now()) {
    signalingData.delete(pubkey);
    return null;
  }
  return signal.data;
};

/**
 * ✅ Limpiar señales expiradas
 */
export const cleanExpiredSignals = () => {
  const now = Date.now();
  for (const [pubkey, signal] of signalingData) {
    if (signal.expirationTime < now) {
      signalingData.delete(pubkey);
      console.log(`🗑️ Señal eliminada: ${pubkey}`);
    }
  }
};
