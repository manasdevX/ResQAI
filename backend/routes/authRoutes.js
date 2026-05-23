import express from 'express';
import {
  signupUser,
  loginUser,
  getMe,
  googleAuth,
  verifyEmailOTP,
  resendEmailOTP,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup',          signupUser);
router.post('/login',           loginUser);
router.post('/google',          googleAuth);
router.get('/me',               protect, getMe);
router.post('/verify-otp',      verifyEmailOTP);
router.post('/resend-otp',      resendEmailOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
