// src/modules/signal/controllers/signal.controller.js
import { setSignal, getSignal, cleanExpiredSignals } from '../services/signal.service.js';

/**
 * ✅ Estado de la Signal API
 * GET /api/signal/
 */
export const getSignalStatus = (req, res) => {
  return res.status(200).json({
    status: '✅ Signal API active',
    ts: new Date().toISOString(),
    nextStep: 'USE_ENDPOINTS',
  });
};

/**
 * ✅ Enviar señal
 * POST /api/signal/
 * body: { pubkey: <destinatario>, data: <payload arbitrario> }
 * (Protegido con JWT a nivel de router)
 */
export const sendSignal = async (req, res) => {
  const sender = req.user?.wallet || null;
  const { pubkey, data } = req.body || {};

  if (!pubkey || typeof data === 'undefined') {
    return res.status(400).json({ error: 'MISSING_FIELDS', nextStep: 'CHECK_INPUT' });
  }
  if (sender && pubkey === sender) {
    return res.status(400).json({ error: 'INVALID_TARGET', nextStep: 'CHOOSE_OTHER_TARGET' });
  }

  // Guarda señal efímera para el destinatario (el service maneja TTL)
  setSignal(pubkey, { from: sender, payload: data, at: Date.now() });

  return res.status(200).json({ status: '✅ Señal enviada con éxito', nextStep: 'AWAIT_RESPONSE' });
};

/**
 * ✅ Obtener señal
 * GET /api/signal/:pubkey
 * (Protegido con JWT a nivel de router)
 */
export const retrieveSignal = async (req, res) => {
  const requester = req.user?.wallet || null;
  const { pubkey } = req.params;

  const signalData = getSignal(pubkey);
  if (!signalData) {
    return res.status(404).json({ error: 'NOT_FOUND', nextStep: 'SEND_NEW_SIGNAL' });
  }

  return res.status(200).json({ data: signalData, nextStep: 'PROCESS_SIGNAL' });
};

/** ♻️ Limpieza periódica (evita múltiples intervalos en hot-reload) */
if (!global.__signalCleanupInterval) {
  global.__signalCleanupInterval = setInterval(() => {
    try { cleanExpiredSignals(); } catch {}
  }, 60 * 1000);
}
