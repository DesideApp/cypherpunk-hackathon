// src/modules/activity/services/activityEvent.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced MongoDB aggregations
// for activity trends and complex filtering logic. Full implementation
// available in private repository.

import ActivityEvent from '../models/activityEvent.model.js';
import Contact from '#modules/contacts/models/contact.model.js';
import { ContactStatus } from '#modules/contacts/contact.constants.js';

import {
  ActivityVisibility,
  ActivityStatus,
  DEFAULT_FEED_PAGE_SIZE,
  MAX_FEED_PAGE_SIZE,
  DEFAULT_STATS_LIMIT,
  MAX_STATS_LIMIT,
  DEFAULT_STATS_WINDOW_MINUTES,
} from '../activity.constants.js';

const VALID_VISIBILITY_FOR_CONTACTS = [
  ActivityVisibility.CONTACTS,
  ActivityVisibility.PUBLIC,
];

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, min), max);
  }
  return fallback;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime?.()) ? null : date;
};

async function fetchAcceptedContacts(wallet) {
  const [outgoing, incoming] = await Promise.all([
    Contact.find({ owner: wallet, status: ContactStatus.ACCEPTED }, { contact: 1, _id: 0 }).lean(),
    Contact.find({ contact: wallet, status: ContactStatus.ACCEPTED }, { owner: 1, _id: 0 }).lean(),
  ]);

  const contacts = new Set();
  for (const doc of outgoing) {
    if (doc?.contact) contacts.add(doc.contact);
  }
  for (const doc of incoming) {
    if (doc?.owner) contacts.add(doc.owner);
  }
  contacts.delete(wallet);
  return Array.from(contacts);
}

export async function recordActivityEvent(data, { dedupeKey = null } = {}) {
  const payload = {
    actor: data.actor,
    actionType: data.actionType,
    title: data.title ?? null,
    description: data.description ?? null,
    visibility: data.visibility ?? ActivityVisibility.CONTACTS,
    status: data.status ?? ActivityStatus.CONFIRMED,
    source: data.source ?? undefined,
    occurredAt: toDateOrNull(data.occurredAt) ?? new Date(),
    asset: data.asset ?? undefined,
    amount: data.amount ?? null,
    amountUsd: data.amountUsd ?? null,
    txSignature: data.txSignature ?? null,
    slot: data.slot ?? null,
    counterparty: data.counterparty ?? undefined,
    metadata: data.metadata ?? undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : undefined,
    digestHash: data.digestHash ?? dedupeKey ?? null,
  };

  // Simplified deduplication - production version has advanced logic
  if (payload.digestHash) {
    const existing = await ActivityEvent.findOne({ digestHash: payload.digestHash }).lean();
    if (existing) {
      return existing;
    }
  }

  const doc = await ActivityEvent.create(payload);
  return doc.toObject();
}

export async function getActivityFeedForViewer(
  viewerWallet,
  {
    limit = DEFAULT_FEED_PAGE_SIZE,
    cursor,
    actionTypes,
    visibility,
    source,
    status = ActivityStatus.CONFIRMED,
    since,
    until,
  } = {}
) {
  if (!viewerWallet) {
    throw new Error('viewerWallet es requerido');
  }

  const normalizedLimit = clampNumber(limit, 1, MAX_FEED_PAGE_SIZE, DEFAULT_FEED_PAGE_SIZE);
  const cursorDate = toDateOrNull(cursor);
  const sinceDate = toDateOrNull(since);
  const untilDate = toDateOrNull(until);

  const contacts = await fetchAcceptedContacts(viewerWallet);
  const contactsOnly = contacts.filter((wallet) => wallet !== viewerWallet);

  const orConditions = [{ actor: viewerWallet }];
  if (contactsOnly.length > 0) {
    orConditions.push({
      actor: { $in: contactsOnly },
      visibility: { $in: VALID_VISIBILITY_FOR_CONTACTS },
    });
  }

  const query = orConditions.length > 1 ? { $or: orConditions } : orConditions[0];

  const extraFilters = {};

  if (Array.isArray(actionTypes) && actionTypes.length > 0) {
    extraFilters.actionType = { $in: actionTypes };
  }

  if (Array.isArray(source) && source.length > 0) {
    extraFilters.source = { $in: source };
  } else if (typeof source === 'string' && source.trim().length > 0) {
    extraFilters.source = source.trim();
  }

  if (Array.isArray(visibility) && visibility.length > 0) {
    extraFilters.visibility = { $in: visibility };
  } else if (typeof visibility === 'string' && visibility.trim().length > 0) {
    extraFilters.visibility = visibility.trim();
  }

  if (status) {
    extraFilters.status = status;
  }

  if (sinceDate || untilDate) {
    extraFilters.occurredAt = {};
    if (sinceDate) extraFilters.occurredAt.$gte = sinceDate;
    if (untilDate) extraFilters.occurredAt.$lte = untilDate;
  }

  if (cursorDate) {
    extraFilters.occurredAt = extraFilters.occurredAt || {};
    extraFilters.occurredAt.$lt = cursorDate;
  }

  const finalQuery = { ...query, ...extraFilters };

  const docs = await ActivityEvent.find(finalQuery)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(normalizedLimit + 1)
    .lean();

  const hasMore = docs.length > normalizedLimit;
  const events = hasMore ? docs.slice(0, normalizedLimit) : docs;
  const nextCursor = hasMore ? events[events.length - 1]?.occurredAt?.toISOString?.() ?? null : null;

  return {
    viewer: viewerWallet,
    events,
    pagination: {
      limit: normalizedLimit,
      nextCursor,
      hasMore,
    },
  };
}

// Simplified trends aggregation - production version has advanced grouping logic
export async function getActivityTrendsForViewer(
  viewerWallet,
  {
    limit = DEFAULT_STATS_LIMIT,
    windowMinutes = DEFAULT_STATS_WINDOW_MINUTES,
    actionTypes,
    minUniqueActors = 1,
    status = ActivityStatus.CONFIRMED,
  } = {}
) {
  if (!viewerWallet) {
    throw new Error('viewerWallet es requerido');
  }

  const normalizedLimit = clampNumber(limit, 1, MAX_STATS_LIMIT, DEFAULT_STATS_LIMIT);
  const normalizedWindowMinutes = clampNumber(windowMinutes, 5, 7 * 24 * 60, DEFAULT_STATS_WINDOW_MINUTES);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - normalizedWindowMinutes * 60 * 1000);

  const contacts = await fetchAcceptedContacts(viewerWallet);
  const contactsOnly = contacts.filter((wallet) => wallet !== viewerWallet);

  const orConditions = [{ actor: viewerWallet }];
  if (contactsOnly.length > 0) {
    orConditions.push({
      actor: { $in: contactsOnly },
      visibility: { $in: VALID_VISIBILITY_FOR_CONTACTS },
    });
  }

  const match = orConditions.length > 1 ? { $or: orConditions } : orConditions[0];
  match.occurredAt = { $gte: windowStart, $lte: windowEnd };

  if (status) {
    match.status = status;
  }

  if (Array.isArray(actionTypes) && actionTypes.length > 0) {
    match.actionType = { $in: actionTypes };
  }

  // Simplified aggregation - production version has advanced grouping
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          actionType: '$actionType',
          assetMint: '$asset.mint',
        },
        eventCount: { $sum: 1 },
        uniqueActors: { $addToSet: '$actor' },
        lastEventAt: { $max: '$occurredAt' },
      },
    },
    {
      $addFields: {
        uniqueActorCount: { $size: '$uniqueActors' },
      },
    },
    {
      $match: {
        uniqueActorCount: { $gte: Math.max(1, minUniqueActors) },
      },
    },
    {
      $project: {
        _id: 0,
        actionType: '$_id.actionType',
        asset: {
          mint: '$_id.assetMint',
        },
        eventCount: 1,
        uniqueActorCount: 1,
        lastEventAt: 1,
      },
    },
    {
      $sort: {
        eventCount: -1,
        uniqueActorCount: -1,
        lastEventAt: -1,
      },
    },
    { $limit: normalizedLimit },
  ];

  const results = await ActivityEvent.aggregate(pipeline);

  return {
    viewer: viewerWallet,
    window: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
      minutes: normalizedWindowMinutes,
    },
    entries: results,
  };
}
