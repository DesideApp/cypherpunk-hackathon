import { listMessagesForConversation } from '../services/history.service.js';

const DEFAULT_LIMIT = 50;

export async function getConversationMessages(req, res, next) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const { convId } = req.params;
    if (!convId) return res.status(400).json({ error: 'invalid_conversation' });

    const limit = Number.parseInt(req.query.limit, 10);
    const beforeSeq = req.query.before ? Number.parseInt(req.query.before, 10) : undefined;

    const result = await listMessagesForConversation({
      wallet,
      convId,
      limit: Number.isFinite(limit) ? limit : DEFAULT_LIMIT,
      beforeSeq: Number.isFinite(beforeSeq) ? beforeSeq : undefined,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

