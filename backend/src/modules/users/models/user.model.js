// #modules/users/models/user.model.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  wallet: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator(v) {
        // Base58 (sin 0OIl) 32-44 chars (rango típico de pubkeys Solana)
        return /^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(v);
      },
      message: props => `${props.value} no es una clave pública válida.`,
    },
  },

  // Registro / login
  registeredAt: { type: Date, default: Date.now },
  lastLogin:    { type: Date, default: Date.now },
  loginCount:   { type: Number, default: 1 },
  csrfToken:    { type: String, default: null },

  // Perfil opcional (usado en /users/:pubkey)
  nickname: { type: String, default: null },
  avatar:   { type: String, default: null }, // URL o CID/IPFS si aplica

  // Moderación
  // Alias: `user.isBanned` apunta a `banned`
  banned: { type: Boolean, default: false, alias: 'isBanned' },

  // ===== Relay por usuario =====
  relayTier: { type: String, enum: ['basic'], default: 'basic' },

  // Límites de relay por usuario
  relayQuotaBytes:      { type: Number, default: 8 * 1024 * 1024 },   // 8 MB
  relayUsedBytes:       { type: Number, default: 0, min: 0 },
  relayTTLSeconds:      { type: Number, default: 5 * 24 * 60 * 60 },  // 5 días
  relayOverflowGracePct:{ type: Number, default: 0 },
  relayAutoPurge:       { type: Boolean, default: false },

  // Role
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, {
  // No uso timestamps automáticos para no duplicar con registeredAt/lastLogin
  minimize: true,
});

// Índices
userSchema.index({ wallet: 1 }, { unique: true });
userSchema.index({ lastLogin: -1 });

const User = mongoose.model('User', userSchema);
export default User;
