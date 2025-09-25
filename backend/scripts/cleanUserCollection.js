import mongoose from 'mongoose';
import dotenv from 'dotenv';
import '../src/modules/users/models/user.model.js';

const User = mongoose.model('User');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function cleanUserCollection() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Conectado a MongoDB Atlas');

    await User.updateMany({}, {
      $unset: {
        contacts: "",
        blockedContacts: "",
        csrfToken: ""
      }
    });

    console.log('✅ Campos innecesarios eliminados.');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

cleanUserCollection();
