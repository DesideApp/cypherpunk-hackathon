import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  convId: { type: String, required: true, index: true },
  seq: { type: Number, required: true },
  sender: { type: String, required: true, trim: true },
  participants: { type: [String], required: true },
  relayMessageId: { type: String, required: true, trim: true, unique: true },
  clientMsgId: { type: String, trim: true },
  box: { type: String, required: true },
  boxSize: { type: Number, required: true, min: 0 },
  iv: { type: String, default: null },
  messageType: { type: String, default: 'text', trim: true },
  meta: { type: Map, of: mongoose.Schema.Types.Mixed, default: undefined },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

messageSchema.index({ convId: 1, seq: -1 });
messageSchema.index({ convId: 1, seq: 1 }, { unique: true });
messageSchema.index({ convId: 1, createdAt: -1 });
messageSchema.index({ clientMsgId: 1 }, { unique: true, sparse: true });

export default mongoose.model('ConversationMessage', messageSchema);

