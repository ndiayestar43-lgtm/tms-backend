import { Router } from 'express';
import { chat, clearConversation } from '../controllers/ai.controller';
import { aiRateLimit } from '../middleware/validate.middleware';

const router = Router();

router.post('/chat', aiRateLimit, chat);
router.delete('/conversation', clearConversation);

export default router;
