import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resetAbuseState,
  recordAbuseEvent,
  shouldBlock,
  unblockEntity,
  getAbuseSnapshot,
} from '../relayAbuse.service.js';

const WALLET = 'wallet-test-1';

test('relay abuse service blocks after reaching threshold', () => {
  resetAbuseState();
  let result = null;
  for (let i = 0; i < 5; i += 1) {
    result = recordAbuseEvent({ scope: 'wallet', id: WALLET, reason: 'invalid_pubkey' });
  }
  assert.ok(result, 'should return result');
  assert.equal(result.count, 5);
  assert.equal(result.blocked, true);

  const blockInfo = shouldBlock({ scope: 'wallet', id: WALLET });
  assert.ok(blockInfo, 'wallet should be blocked after reaching threshold');
  assert.equal(blockInfo.reason, 'invalid_pubkey');
  assert.ok(blockInfo.retryAfterSeconds >= 0);
});

test('relay abuse service unblock clears block state', () => {
  resetAbuseState();
  for (let i = 0; i < 5; i += 1) {
    recordAbuseEvent({ scope: 'wallet', id: WALLET, reason: 'invalid_pubkey' });
  }
  const before = shouldBlock({ scope: 'wallet', id: WALLET });
  assert.ok(before, 'wallet should be blocked before unblock');

  const removed = unblockEntity({ scope: 'wallet', id: WALLET });
  assert.equal(removed, true);

  const after = shouldBlock({ scope: 'wallet', id: WALLET });
  assert.equal(after, null);
  assert.equal(getAbuseSnapshot().length, 0);
});
