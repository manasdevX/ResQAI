import express from 'express';
import {
  getChatUsers,
  getDMHistory,
  sendDM,
  getIncidentThread,
  postToIncidentThread,
  markDMRead,
  getUnreadCounts,
  deleteMessage,
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All chat routes are protected
router.use(protect);

// Users list (for new conversations)
router.get('/users', getChatUsers);

// Unread counts
router.get('/unread', getUnreadCounts);

// DM routes — /nearby-style collision prevention: specific before :param
router.get('/dm/:userId',        getDMHistory);
router.post('/dm/:userId',       sendDM);
router.patch('/dm/:userId/read', markDMRead);

// Incident thread routes
router.get('/incident/:incidentId',  getIncidentThread);
router.post('/incident/:incidentId', postToIncidentThread);

// Message actions
router.delete('/message/:messageId', deleteMessage);

export default router;
