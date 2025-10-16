// src/modules/activity/controllers/activityFeed.controller.js
import {
  getActivityFeedForViewer,
  getActivityTrendsForViewer,
} from '../services/activityEvent.service.js';

import {
  ActivityStatus,
} from '../activity.constants.js';

const toList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

export async function listActivityEvents(req, res, next) {
  try {
    const viewer = req.user?.wallet || req.user?.pubkey;
    if (!viewer) return res.status(401).json({ error: 'unauthorized' });

    const {
      limit,
      cursor,
      status,
      since,
      until,
    } = req.query;

    const actionTypes = toList(req.query.action || req.query.actionType);
    const visibility = toList(req.query.visibility);
    const source = toList(req.query.source);

    const options = {
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      cursor,
      actionTypes,
      visibility,
      source,
      status: status || ActivityStatus.CONFIRMED,
      since,
      until,
    };

    const result = await getActivityFeedForViewer(viewer, options);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function listActivityTrends(req, res, next) {
  try {
    const viewer = req.user?.wallet || req.user?.pubkey;
    if (!viewer) return res.status(401).json({ error: 'unauthorized' });

    const {
      limit,
      windowMinutes,
      minUniqueActors,
      status,
    } = req.query;

    const actionTypes = toList(req.query.action || req.query.actionType);

    const options = {
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      windowMinutes: windowMinutes ? Number.parseInt(windowMinutes, 10) : undefined,
      minUniqueActors: minUniqueActors ? Number.parseInt(minUniqueActors, 10) : undefined,
      actionTypes,
      status: status || ActivityStatus.CONFIRMED,
    };

    const result = await getActivityTrendsForViewer(viewer, options);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
