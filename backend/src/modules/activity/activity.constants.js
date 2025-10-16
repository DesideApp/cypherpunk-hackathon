// src/modules/activity/activity.constants.js

export const ActivityVisibility = Object.freeze({
  PUBLIC: 'public',
  CONTACTS: 'contacts',
  PRIVATE: 'private',
});

export const ActivityStatus = Object.freeze({
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  FAILED: 'failed',
});

export const ActivitySource = Object.freeze({
  BLINK: 'blink',
  SYSTEM: 'system',
  MANUAL: 'manual',
  IMPORT: 'import',
});

export const ActivityAction = Object.freeze({
  TOKEN_PURCHASE: 'token_purchase',
  TOKEN_SELL: 'token_sell',
  TOKEN_TRANSFER: 'token_transfer',
  ACCOUNT_FOLLOW: 'account_follow',
  ACCOUNT_UNFOLLOW: 'account_unfollow',
  CUSTOM: 'custom',
});

export const DEFAULT_FEED_PAGE_SIZE = 25;
export const MAX_FEED_PAGE_SIZE = 100;
export const DEFAULT_STATS_LIMIT = 10;
export const MAX_STATS_LIMIT = 50;
export const DEFAULT_STATS_WINDOW_MINUTES = 24 * 60; // 24h
