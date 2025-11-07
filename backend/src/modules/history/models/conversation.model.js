import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  wallet: { type: String, required: true, trim: true },
  lastReadSeq: { type: Number, default: 0 },
  lastReadAt: { type: Date, default: null },
  joinedAt: { type: Date, default: () => new Date() },
  pinned: { type: Boolean, default: false },
  mutedUntil: { type: Date, default: null },
}, { _id: false });

const lastMessageTimestampsSchema = new mongoose.Schema({
  deliveredAt: { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
}, { _id: false });

const lastMessageSchema = new mongoose.Schema({
  seq: { type: Number, required: true },
  sender: { type: String, required: true, trim: true },
  source: { type: String, default: 'relay', trim: true },
  relayMessageId: { type: String, trim: true },
  messageId: { type: String, trim: true },
  messageType: { type: String, default: 'text', trim: true },
  boxSize: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() },
  timestamps: { type: lastMessageTimestampsSchema, default: undefined },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // deterministic conversation key
  participants: {
    type: [String],
    required: true,
    validate: {
      validator(value) { return Array.isArray(value) && value.length >= 2; },
      message: 'Conversation must have at least two participants'
    }
  },
  members: { type: [memberSchema], required: true },
  seqMax: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  lastMessage: { type: lastMessageSchema, default: null },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: undefined },
}, {
  timestamps: true,
  versionKey: false,
});

conversationSchema.index({ 'members.wallet': 1, updatedAt: -1 });
conversationSchema.index({ updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
