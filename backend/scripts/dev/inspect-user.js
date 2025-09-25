// node scripts/dev/inspect-user.js WALLET=<pubkey>
import 'dotenv/config';
import mongoose from 'mongoose';
import '../../src/modules/users/models/user.model.js';

const User = mongoose.model('User');

const { MONGO_URI, MONGO_DB_NAME, WALLET } = process.env;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI requerido');
  process.exit(1);
}
if (!WALLET) {
  console.error('❌ WALLET=<pubkey> requerido');
  process.exit(1);
}

const main = async () => {
  await mongoose.connect(MONGO_URI, MONGO_DB_NAME ? { dbName: MONGO_DB_NAME } : {});
  const u = await User.findOne({ wallet: WALLET }).lean();
  console.log(u ? {
    wallet: u.wallet,
    isPremium: u.isPremium,
    relayTier: u.relayTier,
    relayQuotaBytes: u.relayQuotaBytes,
    relayTTLSeconds: u.relayTTLSeconds,
    relayOverflowGracePct: u.relayOverflowGracePct
  } : { message: 'No existe usuario' });
  await mongoose.disconnect();
};
main().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch {} process.exit(1); });
