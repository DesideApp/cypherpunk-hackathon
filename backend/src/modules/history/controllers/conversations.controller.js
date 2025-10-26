import {
  listConversationsForUser,
  markConversationRead,
} from '../services/history.service.js';

const DEFAULT_LIMIT = 20;

export async function getConversations(req, res, next) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const limit = Number.parseInt(req.query.limit, 10);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await listConversationsForUser({
      wallet,
      limit: Number.isFinite(limit) ? limit : DEFAULT_LIMIT,
      cursor,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function markConversationAsRead(req, res, next) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const { convId } = req.params;
    const seq = Number.parseInt(req.body?.lastReadSeq ?? req.body?.seq, 10);
    if (!convId || !Number.isFinite(seq)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const ok = await markConversationRead({ wallet, convId, seq });
    if (!ok) return res.status(404).json({ error: 'not_found' });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

