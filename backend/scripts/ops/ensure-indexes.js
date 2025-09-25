// scripts/ops/ensure-indexes.js
import mongoose from 'mongoose';
import User from '../../src/models/User.js';
import Contact from '../../src/models/Contact.js';
import Stats from '../../src/models/Stats.js';
import Notification from '../../src/models/Notification.js';
import RelayMessage from '../../src/models/RelayMessage.js';
import EventLog from '../../src/models/EventLog.js';
import SecurityLog from '../../src/models/SecurityLog.js';
import Payment from '../../src/models/Payments.js';
import Bio from '../../src/models/Bio.js';
import Backup from '../../src/models/Backup.js';

const uri = process.env.MONGO_URI;
const opts = process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {};

(async () => {
  await mongoose.connect(uri, opts);
  await Promise.all([
    User.syncIndexes(),
    Contact.syncIndexes(),
    Stats.syncIndexes(),
    Notification.syncIndexes(),
    RelayMessage.syncIndexes(),
    EventLog.syncIndexes(),
    SecurityLog.syncIndexes(),
    Payment.syncIndexes(),
    Bio.syncIndexes(),
    Backup.syncIndexes(),
  ]);
  console.log('✅ Índices reconciliados para todos los modelos.');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
