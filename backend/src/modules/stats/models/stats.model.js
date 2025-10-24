import mongoose from 'mongoose';

const StatsSchema = new mongoose.Schema({
  user: { type: String, required: true, unique: true },
  messagesSent: { type: Number, default: 0 },
  messagesReceived: { type: Number, default: 0 },
  web3Connections: { type: Number, default: 0 },
  backupsCreated: { type: Number, default: 0 },
  storageUsed: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  tokensAdded: { type: Number, default: 0 },
  blinkMetadataHits: { type: Number, default: 0 },
  blinkExecutes: { type: Number, default: 0 },
  blinkVolume: { type: Number, default: 0 },
  naturalCommandsParsed: { type: Number, default: 0 },
  naturalCommandsExecuted: { type: Number, default: 0 },
  naturalCommandsRejected: { type: Number, default: 0 },
  naturalCommandsFailed: { type: Number, default: 0 },
  dmStarted: { type: Number, default: 0 },
  dmAccepted: { type: Number, default: 0 },
  relayMessages: { type: Number, default: 0 },
  events: [
    {
      type: { type: String, required: true },
      data: { type: mongoose.Schema.Types.Mixed },
      timestamp: { type: Date, default: Date.now, index: true }
    }
  ],
  connectionHistory: [
    {
      timestamp: { type: Date, default: Date.now },
      platform: { type: String, enum: ['web', 'mobile', 'extension'], default: 'web' },
      country: { type: String }
    }
  ]
}, { timestamps: true });

StatsSchema.index({ lastActive: -1 });

export default mongoose.model('Stats', StatsSchema);
