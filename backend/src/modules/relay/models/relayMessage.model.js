import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// TTL (segundos). Usa RELAY_MESSAGE_TTL o RELAY_TTL_SECONDS. Fallback: 90 días.
const FALLBACK_TTL = 60 * 60 * 24 * 90; // 7776000
const parsed = parseInt(
  process.env.RELAY_MESSAGE_TTL ?? process.env.RELAY_TTL_SECONDS ?? String(FALLBACK_TTL),
  10
);
const TTL_SECONDS = Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_TTL;

// Validaciones básicas
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Base58 sin 0OIl, longitud típica Solana 32..44 chars
const SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const relaySchema = new mongoose.Schema(
  {
    /**
     * ID del mensaje (UUID v4 generado por el cliente).
     * Usamos _id para idempotencia y de-dupe.
     */
    _id: {
      type: String,
      required: true,
      trim: true,
      validate: { validator: (v) => UUID_V4.test(v), message: "INVALID_MESSAGE_ID_FORMAT" },
    },

    /** 🔐 Clave pública del remitente (wallet del emisor). */
    from: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: { validator: (v) => SOLANA_PUBKEY.test(v), message: "INVALID_PUBKEY_FORMAT" },
    },

    /** 🔐 Clave pública de destino (wallet del destinatario). */
    to: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: { validator: (v) => SOLANA_PUBKEY.test(v), message: "INVALID_PUBKEY_FORMAT" },
    },

    /**
     * 📦 Datos cifrados del mensaje (E2EE, p.ej. base64).
     * Puede incluir texto y adjuntos pequeños ya cifrados end-to-end.
     */
    box: { type: String, required: true },

    /** 📏 Tamaño en bytes del campo 'box' (base64) para computar uso rápido. */
    boxSize: { type: Number, required: true, min: 1 },

    /** 📝 IV opcional usado en el cifrado (ej. para AES-GCM). */
    iv: { type: String, default: null },

    /** 🏷️ Tipo de mensaje para categorización */
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'audio', 'video', 'system', 'other', 'blink-action'],
      default: 'text',
      index: true
    },

    /** 🔢 Número de secuencia para ordenamiento dentro de una conversación */
    sequenceNumber: { type: Number, default: 0 },

    /** 📱 Información del cliente que envió el mensaje */
    clientInfo: {
      platform: { type: String }, // 'web', 'ios', 'android', 'desktop'
      version: { type: String },   // versión de la app
      userAgent: { type: String }  // para debugging
    },

    /** ℹ️ Metadatos de dominio (acciones, acuerdos, etc.) */
    meta: {
      kind: { type: String, trim: true, index: true },          // agreement, payment-request, blink-action...
      agreementId: { type: String, trim: true },                 // identificador de acuerdo en backend
      convId: { type: String, trim: true },                      // conversación A:B
      clientId: { type: String, trim: true },                    // identificador original del cliente
      from: { type: String, trim: true },                        // redundante para auditoría
      to: { type: String, trim: true },
      step: { type: String, trim: true },                        // pending_a, pending_b, etc.
      status: { type: String, trim: true },                      // estado lógico adicional
    },

    /** 🌐 Metadatos de red */
    networkInfo: {
      ip: { type: String },        // IP del remitente (para auditoría)
      country: { type: String },   // país detectado
      relayAttempts: { type: Number, default: 1 }, // número de intentos de envío
    },

    /** ⏱️ Timestamps adicionales */
    timestamps: {
      enqueuedAt: { type: Date, default: Date.now }, // cuándo se encoló
      deliveredAt: { type: Date },                   // cuándo se entregó (fetch)
      acknowledgedAt: { type: Date },                // cuándo se confirmó (ack)
    },

    /** 📊 Estado del mensaje */
    status: {
      type: String,
      enum: ['pending', 'delivered', 'acknowledged', 'failed'],
      default: 'pending',
      index: true
    },

    /** 🔐 Información de cifrado */
    encryption: {
      algorithm: { type: String, default: 'aes-256-gcm' },
      keyVersion: { type: String }, // para rotación de claves
      authTag: { type: String },    // tag de autenticación si aplica
    },

    /** 🏃‍♂️ Performance y debugging */
    performance: {
      processingTimeMs: { type: Number }, // tiempo de procesamiento en backend
      queuePosition: { type: Number },    // posición en cola cuando se encoló
    },

    /** 🗂️ Referencia a conversación/hilo si aplica */
    conversation: {
      threadId: { type: String },    // ID del hilo de conversación
      replyToId: { type: String },   // ID del mensaje al que responde
      isThread: { type: Boolean, default: false }
    },

    /** ⚠️ Flags especiales */
    flags: {
      isUrgent: { type: Boolean, default: false },
      isEphemeral: { type: Boolean, default: false }, // se auto-destruye después de leer
      requiresAck: { type: Boolean, default: true },  // requiere confirmación explícita
      isRetry: { type: Boolean, default: false },     // es un reintento
    }
  },
  {
    timestamps: true, // createdAt y updatedAt automáticos
    versionKey: false,
  }
);

// Índices para optimizar consultas
relaySchema.index({ to: 1, createdAt: 1 });              // fetch por destinatario ordenado
relaySchema.index({ from: 1, createdAt: 1 });            // mensajes enviados por remitente
relaySchema.index({ status: 1, createdAt: 1 });          // filtrar por estado
relaySchema.index({ messageType: 1, createdAt: 1 });     // filtrar por tipo
relaySchema.index({ 'conversation.threadId': 1, createdAt: 1 }); // hilos de conversación
relaySchema.index({ 'flags.isUrgent': 1, createdAt: 1 }); // mensajes urgentes primero
relaySchema.index(
  { to: 1, 'meta.agreementId': 1 },
  { partialFilterExpression: { 'meta.agreementId': { $exists: true, $type: 'string' } } }
);

// Índice TTL: elimina mensajes automáticamente después de TTL_SECONDS
relaySchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

export default mongoose.model("RelayMessage", relaySchema);
