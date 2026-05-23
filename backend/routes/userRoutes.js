import express from 'express';
import {
  toggleAvailability,
  markSafe,
  updateSkills,
  getAvailableResponders,
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  getAllUsers,
  updateUserRole,
  toggleUserActive,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { avatarUpload } from '../middleware/upload.js';

const router = express.Router();

// Own profile
router.get('/profile',              protect, getProfile);
router.patch('/profile',            protect, updateProfile);
router.patch('/avatar',             protect, avatarUpload.single('avatar'), uploadAvatar);
router.patch('/password',           protect, changePassword);

// Availability / safe / skills
router.patch('/availability',       protect, toggleAvailability);
router.patch('/safe',               protect, markSafe);
router.patch('/skills',             protect, updateSkills);

// Admin-only user management — must come before /:id routes
router.get('/responders',           protect, authorize('admin'), getAvailableResponders);
router.get('/all',                  protect, authorize('admin'), getAllUsers);
router.patch('/:id/role',           protect, authorize('admin'), updateUserRole);
router.patch('/:id/active',         protect, authorize('admin'), toggleUserActive);

export default router;
