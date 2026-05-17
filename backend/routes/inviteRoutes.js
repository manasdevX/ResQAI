import express from 'express';
import {
  createInvite,
  validateInvite,
  listInvites,
  deleteInvite,
} from '../controllers/inviteController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/validate',  validateInvite);
router.post('/',         protect, authorize('admin'), createInvite);
router.get('/',          protect, authorize('admin'), listInvites);
router.delete('/:id',    protect, authorize('admin'), deleteInvite);

export default router;
