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

  // Social (perfiles opcionales)
  social: {
    x: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
    website: {
      type: String,
      default: null,
      trim: true,
    },
  },

  // Moderación
  // Alias: `user.isBanned` apunta a `banned`
  banned: { type: Boolean, default: false, alias: 'isBanned' },

  // ===== Relay por usuario =====
  relayTier: { type: String, enum: ['basic', 'free', 'plus', 'pro', 'growth', 'business', 'enterprise'], default: 'free' },

  // Límites de relay por usuario
  relayQuotaBytes:      { type: Number, default: 30 * 1024 * 1024 },  // 30 MB
  relayUsedBytes:       { type: Number, default: 0, min: 0 },
  relayTTLSeconds:      { type: Number, default: 30 * 24 * 60 * 60 }, // 30 días
  relayOverflowGracePct:{ type: Number, default: 0 },
  relayAutoPurge:       { type: Boolean, default: false },

  // Vault de adjuntos
  vaultQuotaBytes:      { type: Number, default: 500 * 1024 * 1024 },
  vaultUsedBytes:       { type: Number, default: 0, min: 0 },
  vaultTTLSeconds:      { type: Number, default: 30 * 24 * 60 * 60 },

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
