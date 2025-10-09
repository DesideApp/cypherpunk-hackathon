import mongoose from 'mongoose';
import crypto from 'crypto';
import { AgreementStatus } from '../constants.js';

const ReceiptSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: Object.values(AgreementStatus),
    default: AgreementStatus.PENDING_B,
  },
  hash: { type: String },
  txSigA: { type: String },
  txSigB: { type: String },
  signedAAt: { type: Date, default: null },
  signedBAt: { type: Date, default: null },
  lastMemo: { type: String, default: null },
  settlement: {
    status: { type: String, default: null },
    txSig: { type: String, default: null },
    recordedAt: { type: Date, default: null },
  },
}, { _id: false });

const AgreementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, trim: true, maxlength: 500 },
  amount: { type: String, trim: true, default: null },
  token: { type: String, trim: true, uppercase: true, default: null },
  payer: { type: String, required: true, trim: true },
  payee: { type: String, required: true, trim: true },
  participants: [{ type: String, required: true, trim: true }],
  createdBy: { type: String, required: true, trim: true },
  conversationId: { type: String, required: true, trim: true },
  deadline: { type: Date, default: null },
  receipt: { type: ReceiptSchema, default: () => ({}) },
}, { timestamps: true });

AgreementSchema.pre('save', function handleReceipt(next) {
  if (!this.receipt) this.receipt = {};
  if (!this.receipt.hash) {
    const payload = JSON.stringify({
      title: this.title,
      body: this.body,
      amount: this.amount,
      token: this.token,
      payer: this.payer,
      payee: this.payee,
      participants: this.participants,
      createdBy: this.createdBy,
      deadline: this.deadline ? this.deadline.toISOString() : null,
    });
    this.receipt.hash = crypto.createHash('sha256').update(payload).digest('hex');
  }
  if (!this.receipt.status) {
    this.receipt.status = AgreementStatus.PENDING_B;
  }
  next();
});

AgreementSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ getters: true, virtuals: false });
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Agreement = mongoose.models.Agreement || mongoose.model('Agreement', AgreementSchema, 'agreements');

export default Agreement;
