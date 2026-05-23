import express from 'express';
import { getAnalyticsSummary } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/summary', protect, authorize('admin'), getAnalyticsSummary);

export default router;
