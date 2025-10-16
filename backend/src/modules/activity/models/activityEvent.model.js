// src/modules/activity/models/activityEvent.model.js
import mongoose from 'mongoose';

import {
  ActivityAction,
  ActivitySource,
  ActivityStatus,
  ActivityVisibility,
} from '../activity.constants.js';

const SOLANA_PUBKEY = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/;
const TX_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{43,88}$/; // rango típico Solana

const assetSchema = new mongoose.Schema(
  {
    mint: {
      type: String,
      trim: true,
      default: null,
    },
    symbol: {
      type: String,
      trim: true,
      default: null,
    },
    decimals: {
      type: Number,
      min: 0,
      max: 12,
      default: null,
    },
  },
  { _id: false }
);

const counterpartySchema = new mongoose.Schema(
  {
    wallet: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (!value) return true;
          return SOLANA_PUBKEY.test(value);
        },
        message: (props) => `${props.value} no es una clave pública válida.`,
      },
    },
    label: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const activityEventSchema = new mongoose.Schema(
  {
    actor: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: (value) => SOLANA_PUBKEY.test(value),
        message: (props) => `${props.value} no es una clave pública válida.`,
      },
    },

    actionType: {
      type: String,
      required: true,
      enum: Object.values(ActivityAction),
      index: true,
    },

    title: {
      type: String,
      trim: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    visibility: {
      type: String,
      enum: Object.values(ActivityVisibility),
      default: ActivityVisibility.CONTACTS,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(ActivityStatus),
      default: ActivityStatus.CONFIRMED,
      index: true,
    },

    source: {
      type: String,
      enum: Object.values(ActivitySource),
      default: ActivitySource.BLINK,
      index: true,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    asset: {
      type: assetSchema,
      default: undefined,
    },

    amount: {
      type: String, // usar string para no perder precisión en cantidades tokenizadas
      default: null,
    },

    amountUsd: {
      type: Number,
      min: 0,
      default: null,
    },

    txSignature: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (!value) return true;
          return TX_SIGNATURE.test(value);
        },
        message: (props) => `${props.value} no es una firma válida de transacción Solana.`,
      },
    },

    slot: {
      type: Number,
      min: 0,
      default: null,
    },

    counterparty: {
      type: counterpartySchema,
      default: undefined,
    },

    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: undefined,
    },

    tags: {
      type: [String],
      default: [],
      index: true,
    },

    digestHash: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

activityEventSchema.index({ actor: 1, occurredAt: -1 });
activityEventSchema.index({ 'asset.mint': 1, occurredAt: -1 });
activityEventSchema.index({ visibility: 1, occurredAt: -1 });
activityEventSchema.index({ status: 1, occurredAt: -1 });

const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);
export default ActivityEvent;
