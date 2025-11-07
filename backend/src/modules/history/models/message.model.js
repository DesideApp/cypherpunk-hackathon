import mongoose from 'mongoose';

const timestampsSchema = new mongoose.Schema({
  deliveredAt: { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  convId: { type: String, required: true, index: true },
  seq: { type: Number, required: true },
  sender: { type: String, required: true, trim: true },
  source: { type: String, default: 'relay', trim: true },
  messageId: { type: String, trim: true },
  participants: { type: [String], required: true },
  relayMessageId: { type: String, trim: true },
  clientMsgId: { type: String, trim: true },
  box: { type: String, required: true },
  boxSize: { type: Number, required: true, min: 0 },
  iv: { type: String, default: null },
  messageType: { type: String, default: 'text', trim: true },
  meta: { type: Map, of: mongoose.Schema.Types.Mixed, default: undefined },
  timestamps: { type: timestampsSchema, default: undefined },
  attachments: {
    type: [{
      key: { type: String, required: true },
      bucket: { type: String, required: true },
      mimeType: { type: String, required: true },
      sizeBytes: { type: Number, required: true, min: 0 },
      hash: { type: String, default: null },
      thumbnailKey: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      createdAt: { type: Date, default: () => new Date() },
    }],
    default: undefined,
  },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

messageSchema.index({ convId: 1, seq: -1 });
messageSchema.index({ convId: 1, seq: 1 }, { unique: true });
messageSchema.index({ convId: 1, createdAt: -1 });
messageSchema.index({ clientMsgId: 1 }, { unique: true, sparse: true });
messageSchema.index({ relayMessageId: 1 }, { unique: true, sparse: true });
messageSchema.index({ source: 1, messageId: 1 }, { unique: true, sparse: true });
messageSchema.index({ 'attachments.key': 1 }, { sparse: true });
messageSchema.index({ 'attachments.expiresAt': 1 }, { sparse: true });

export default mongoose.model('ConversationMessage', messageSchema);
