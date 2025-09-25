import rateLimit from "express-rate-limit";

// Límite de envío de DMs iniciales (por IP). Ajusta si usas Redis store.
export const dmStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,                  // 20 solicitudes / hora
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", detail: "Too many DM requests. Try later." },
});

// Alternativa: limitar por usuario además de IP (si quieres):
export function perUserPendingLimiter(modelContact) {
  return async function (req, res, next) {
    try {
      const me = req.user?.wallet || req.user?.pubkey;
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const pendingCount = await modelContact.countDocuments({
        owner: me,
        status: { $in: ["pending_out", "PENDING_OUT"] },
      });

      const MAX_PENDING = 50;
      if (pendingCount >= MAX_PENDING) {
        return res.status(429).json({
          error: "too_many_pending",
          detail: `You have ${pendingCount} pending requests. Try later.`,
        });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
