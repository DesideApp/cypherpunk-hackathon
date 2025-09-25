// src/middleware/adminProtect.js

/**
 * Verifica privilegios de administrador.
 * - Por rol: req.user.role === 'admin'  ó  req.user.isAdmin === true
 * - Por wallet: incluida en ADMIN_WALLETS (CSV en .env)
 */
export const adminProtect = (req, res, next) => {
  try {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'Unauthorized' });

    const wallet = (u.wallet || u.address || u.pubkey || '').toString().trim().toLowerCase();
    const role   = (u.role || '').toString().trim().toLowerCase();
    const byRole = role === 'admin' || u.isAdmin === true;

    const rawAdminList = process.env.ADMIN_WALLETS || '';
    const ADMIN_SET = new Set(
      rawAdminList
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    );
    const byWallet = wallet && ADMIN_SET.has(wallet);

    if (byRole || byWallet) return next();

    // Log de seguridad y 403
      'UNAUTHORIZED_ADMIN_ACCESS',
      `Intento de acceso admin por ${wallet || 'desconocido'}`,
      req.ip,
      wallet || null
    );
    return res.status(403).json({ error: 'Admin privileges required' });
  } catch (error) {
    console.error('❌ AdminProtect Error:', error.message);
    return res.status(500).json({ error: 'Failed to verify admin privileges' });
  }
};
