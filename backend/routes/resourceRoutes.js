import express from 'express';
import {
  createResourceRequest,
  getNearbyResourceRequests,
  getMyResourceRequests,
  getAllResourceRequests,
  acknowledgeResourceRequest,
  fulfillResourceRequest,
} from '../controllers/resourceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/',                     protect, createResourceRequest);
router.get('/nearby',                protect, getNearbyResourceRequests);
router.get('/mine',                  protect, getMyResourceRequests);
router.get('/',                      protect, authorize('admin'), getAllResourceRequests);
router.patch('/:id/acknowledge',     protect, acknowledgeResourceRequest);
router.patch('/:id/fulfill',         protect, fulfillResourceRequest);

export default router;
