import express from 'express';
import { getNotifications, markOneRead, markAllRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/',              protect, getNotifications);
router.patch('/read-all',    protect, markAllRead);       // must be before /:id
router.patch('/:id/read',    protect, markOneRead);

export default router;
