import express from 'express';
import {
  toggleAvailability,
  markSafe,
  updateSkills,
  getAvailableResponders,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.patch('/availability', protect, toggleAvailability);
router.patch('/safe',         protect, markSafe);
router.patch('/skills',       protect, updateSkills);
router.get('/responders',     protect, authorize('admin'), getAvailableResponders);

export default router;
