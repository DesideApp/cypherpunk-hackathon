import mongoose from 'mongoose';
import { ContactStatus } from '#modules/contacts/contact.constants.js';

const SOLANA_PUBKEY = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/;

const contactSchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
      validate: { validator: v => SOLANA_PUBKEY.test(v), message: props => `${props.value} no es una clave pública válida.` },
      index: true,
    },
    contact: {
      type: String,
      required: true,
      validate: { validator: v => SOLANA_PUBKEY.test(v), message: props => `${props.value} no es una clave pública válida.` },
      index: true,
    },

    // Estado DM-first
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: ContactStatus.PENDING_OUT,
      index: true,
    },

    // Compat
    blocked: { type: Boolean, default: false },

    // Intro (primer mensaje opcional)
    introSent: { type: Boolean, default: false },
    introText: { type: String, default: "" },

    // Metadatos
    firstInteractionAt: { type: Date },
    expiresAt: { type: Date },  // TTL de la solicitud (si activas índice TTL)
    denyUntil: { type: Date },  // cooldown tras rechazo
  },
  { timestamps: true }
);

// 🔑 Rendimiento + unicidad por par
contactSchema.index({ owner: 1, contact: 1 }, { unique: true });

// Si activas TTL para caducar solicitudes no aceptadas de forma automática:
// contactSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;
