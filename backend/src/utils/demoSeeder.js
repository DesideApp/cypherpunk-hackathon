// src/utils/demoSeeder.js
import logger from '#config/logger.js';
import User from '#modules/users/models/user.model.js';
import Contact from '#modules/contacts/models/contact.model.js';
import { ContactStatus } from '#modules/contacts/contact.constants.js';

const truthy = new Set(['1', 'true', 'yes', 'on']);
const falsy = new Set(['0', 'false', 'no', 'off']);

const shouldSeed = () => {
  const envValue = String(process.env.SEED_DEMO ?? '').trim().toLowerCase();
  if (falsy.has(envValue)) return false;
  if (truthy.has(envValue)) return true;
  // Por defecto solo seed en DATA_MODE=memory
  return (process.env.DATA_MODE || '').toLowerCase() === 'memory';
};

export async function seedDemoData() {
  if (!shouldSeed()) {
    logger.info('🌱 Demo seed deshabilitado (SEED_DEMO=false).');
    return;
  }

  try {
    const demoUsers = [
      {
        wallet: 'vzwA8wheHMSaNnfL18TFn9Jq9BnTX5f8yj5E19vPX8j',
        nickname: 'Alice',
      },
      {
        wallet: '2GeL1ka3YFskzkUoPNeJ1pnyG6Sfj2TxDsCWc6gC5vEE',
        nickname: 'Bob',
      },
      {
        wallet: 'Gwrn3UyMvrdSP8VsQZyTfAYp9qwrcu5ivBujKHufZJFZ',
        nickname: 'Charlie',
      },
    ];

    const contactPairs = [
      ['vzwA8wheHMSaNnfL18TFn9Jq9BnTX5f8yj5E19vPX8j', '2GeL1ka3YFskzkUoPNeJ1pnyG6Sfj2TxDsCWc6gC5vEE'],
      ['vzwA8wheHMSaNnfL18TFn9Jq9BnTX5f8yj5E19vPX8j', 'Gwrn3UyMvrdSP8VsQZyTfAYp9qwrcu5ivBujKHufZJFZ'],
      ['2GeL1ka3YFskzkUoPNeJ1pnyG6Sfj2TxDsCWc6gC5vEE', 'Gwrn3UyMvrdSP8VsQZyTfAYp9qwrcu5ivBujKHufZJFZ'],
    ];

    await Promise.all(
      demoUsers.map(({ wallet, nickname }) =>
        User.updateOne(
          { wallet },
          {
            $setOnInsert: {
              wallet,
              nickname,
              registeredAt: new Date('2024-12-01T00:00:00Z'),
              lastLogin: new Date(),
              loginCount: 5,
            },
          },
          { upsert: true }
        )
      )
    );

    const contactOps = [];
    for (const [owner, contact] of contactPairs) {
      contactOps.push(
        Contact.updateOne(
          { owner, contact },
          {
            $set: {
              owner,
              contact,
              status: ContactStatus.ACCEPTED,
              firstInteractionAt: new Date('2025-01-15T12:00:00Z'),
              blocked: false,
            },
          },
          { upsert: true }
        )
      );
      contactOps.push(
        Contact.updateOne(
          { owner: contact, contact: owner },
          {
            $set: {
              owner: contact,
              contact: owner,
              status: ContactStatus.ACCEPTED,
              firstInteractionAt: new Date('2025-01-15T12:00:00Z'),
              blocked: false,
            },
          },
          { upsert: true }
        )
      );
    }

    await Promise.all(contactOps);

    logger.info('🌱 Demo data seeded (users & contacts).');
  } catch (err) {
    logger.error('❌ Error seeding demo data:', err);
  }
}
