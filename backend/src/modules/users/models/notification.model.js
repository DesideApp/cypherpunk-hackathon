import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  pubkey: { type: String, required: true },
  type: { type: String, required: true },
  data: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

// Índice para listar "no leídas" por usuario rápido
notificationSchema.index({ pubkey: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
