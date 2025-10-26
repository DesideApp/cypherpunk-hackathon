import { Router } from 'express';
import { getConversations, markConversationAsRead } from '../controllers/conversations.controller.js';
import { getConversationMessages } from '../controllers/messages.controller.js';

const router = Router();

router.get('/conversations', getConversations);
router.get('/conversations/:convId/messages', getConversationMessages);
router.post('/conversations/:convId/read', markConversationAsRead);

export default router;

