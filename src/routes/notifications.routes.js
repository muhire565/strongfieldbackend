import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  listActivity,
} from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', authenticate, listNotifications);
router.get('/unread-count', authenticate, unreadCount);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);
router.get('/activity', authenticate, listActivity);

export default router;
