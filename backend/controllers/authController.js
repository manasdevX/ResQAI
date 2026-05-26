import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import Invite from '../models/Invite.js';
import generateToken from '../utils/generateToken.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../utils/emailService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePassword = (password) => {
  if (!password || password.length < 8)
    return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter';
  if (!/\d/.test(password))
    return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password))
    return 'Password must contain at least one special character';
  return null;
};

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const buildAuthResponse = (user) => ({
  _id:             user._id,
  name:            user.name,
  email:           user.email,
  role:            user.role,
  avatar:          user.avatar,
  skills:          user.skills,
  isAvailable:     user.isAvailable,
  isSafe:          user.isSafe,
  isEmailVerified: user.isEmailVerified,
  token:           generateToken(user._id, user.role),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

// @desc    Register a new user — Step 1 (sends OTP, no token yet)
// @route   POST /api/auth/signup
// @access  Public
export const signupUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, inviteToken } = req.body;

    if (!name?.trim())  return res.status(400).json({ message: 'Full name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!password)      return res.status(400).json({ message: 'Password is required' });

    if (!EMAIL_REGEX.test(email.trim()))
      return res.status(400).json({ message: 'Please provide a valid email address' });

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    // Determine role
    let assignedRole = ['citizen', 'responder'].includes(role) ? role : 'citizen';

    if (inviteToken) {
      const invite = await Invite.findOne({ token: inviteToken, usedAt: null });
      if (!invite)
        return res.status(400).json({ message: 'Invalid or already used invite link' });
      if (invite.expiresAt < new Date())
        return res.status(400).json({ message: 'This invite link has expired' });

      const normalizedInviteEmail = email.toLowerCase().trim();
      if (invite.email && invite.email !== normalizedInviteEmail)
        return res.status(400).json({ message: 'This invite was sent to a different email address' });

      assignedRole = invite.role;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing account
    const existingUser = await User.findOne({ email: normalizedEmail })
      .select('+emailOTPSentAt +emailOTP');

    if (existingUser) {
      if (existingUser.isEmailVerified)
        return res.status(400).json({ message: 'An account with this email already exists' });

      // Unverified account: rate-limit resend (1 per 60 s)
      if (
        existingUser.emailOTPSentAt &&
        Date.now() - existingUser.emailOTPSentAt.getTime() < 60_000
      ) {
        const wait = Math.ceil(
          (60_000 - (Date.now() - existingUser.emailOTPSentAt.getTime())) / 1000
        );
        return res.status(429).json({
          requiresVerification: true,
          email: normalizedEmail,
          message: `Please wait ${wait} second${wait !== 1 ? 's' : ''} before requesting another code.`,
        });
      }

      // Resend OTP to existing unverified account
      const otp = generateOTP();
      existingUser.emailOTP         = await bcrypt.hash(otp, 10);
      existingUser.emailOTPExpires  = new Date(Date.now() + 10 * 60_000);
      existingUser.emailOTPAttempts = 0;
      existingUser.emailOTPSentAt   = new Date();
      await existingUser.save();
      await sendOTPEmail(normalizedEmail, existingUser.name, otp);

      return res.status(200).json({
        requiresVerification: true,
        email: normalizedEmail,
        message: 'Verification code sent to your email',
      });
    }

    // Create new user (unverified)
    const user = await User.create({
      name:            name.trim(),
      email:           normalizedEmail,
      password,
      role:            assignedRole,
      phone:           phone?.trim() || undefined,
      isEmailVerified: false,
    });

    // Mark invite as used
    if (inviteToken) {
      await Invite.findOneAndUpdate(
        { token: inviteToken },
        { usedAt: new Date(), usedBy: user._id }
      );
    }

    // Generate + store OTP
    const otp = generateOTP();
    user.emailOTP         = await bcrypt.hash(otp, 10);
    user.emailOTPExpires  = new Date(Date.now() + 10 * 60_000);
    user.emailOTPAttempts = 0;
    user.emailOTPSentAt   = new Date();
    await user.save();

    await sendOTPEmail(normalizedEmail, user.name, otp);

    return res.status(201).json({
      requiresVerification: true,
      email: normalizedEmail,
      message: 'Account created! Please check your email for the verification code.',
    });
  } catch (error) {
    if (error.code === 11000)
      return res.status(400).json({ message: 'An account with this email already exists' });
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Verify email OTP — Step 2 (returns full auth token)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp)
      return res.status(400).json({ message: 'Email and verification code are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+emailOTP +emailOTPExpires +emailOTPAttempts');

    if (!user)
      return res.status(404).json({ message: 'Account not found. Please sign up again.' });

    // Already verified — issue token immediately
    if (user.isEmailVerified)
      return res.json(buildAuthResponse(user));

    if (!user.emailOTP)
      return res.status(400).json({ message: 'No verification code found. Please request a new one.' });

    if (user.emailOTPExpires < new Date())
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });

    if (user.emailOTPAttempts >= 5)
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.', remainingAttempts: 0 });

    const isMatch = await bcrypt.compare(otp.toString().trim(), user.emailOTP);

    if (!isMatch) {
      user.emailOTPAttempts = (user.emailOTPAttempts || 0) + 1;
      await user.save();
      const remaining = 5 - user.emailOTPAttempts;
      return res.status(400).json({
        message:           `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        remainingAttempts: remaining,
      });
    }

    // OTP correct — verify email
    user.isEmailVerified  = true;
    user.emailOTP         = undefined;
    user.emailOTPExpires  = undefined;
    user.emailOTPAttempts = 0;
    await user.save();

    return res.json(buildAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Resend email OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email?.trim())
      return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+emailOTPSentAt +emailOTP');

    if (!user)
      return res.status(404).json({ message: 'Account not found' });

    if (user.isEmailVerified)
      return res.status(400).json({ message: 'This email is already verified' });

    // Rate limit: 1 per 60 seconds
    if (user.emailOTPSentAt && Date.now() - user.emailOTPSentAt.getTime() < 60_000) {
      const wait = Math.ceil(
        (60_000 - (Date.now() - user.emailOTPSentAt.getTime())) / 1000
      );
      return res.status(429).json({
        message:     `Please wait ${wait} second${wait !== 1 ? 's' : ''} before requesting another code.`,
        waitSeconds: wait,
      });
    }

    const otp = generateOTP();
    user.emailOTP         = await bcrypt.hash(otp, 10);
    user.emailOTPExpires  = new Date(Date.now() + 10 * 60_000);
    user.emailOTPAttempts = 0;
    user.emailOTPSentAt   = new Date();
    await user.save();

    await sendOTPEmail(user.email, user.name, otp);

    return res.json({ message: 'New verification code sent to your email' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    if (!EMAIL_REGEX.test(email.trim()))
      return res.status(400).json({ message: 'Please provide a valid email address' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +emailOTPSentAt');

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    // Only block accounts that went through the new OTP signup flow but never verified.
    // Old accounts (emailOTPSentAt = null) are allowed through without verification.
    if (!user.isEmailVerified && user.emailOTPSentAt) {
      return res.status(403).json({
        requiresVerification: true,
        email: user.email,
        message: 'Please verify your email before logging in.',
      });
    }

    return res.json(buildAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Request a password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!EMAIL_REGEX.test(email.trim())) return res.status(400).json({ message: 'Please provide a valid email address' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetPasswordToken +resetPasswordExpires');

    // Always respond with success to prevent email enumeration attacks
    const genericResponse = { message: 'If that email is registered, a reset link has been sent.' };

    if (!user) return res.status(200).json(genericResponse);

    // Prevent token spam: block if a non-expired token was issued in the last 60 seconds
    if (user.resetPasswordExpires && user.resetPasswordExpires > new Date(Date.now() - 59 * 60_000)) {
      const alreadyRequested = user.resetPasswordExpires > new Date();
      if (alreadyRequested) return res.status(200).json(genericResponse);
    }

    // Generate a cryptographically secure token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60_000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('[forgotPassword] Error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Reset password using the emailed token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token?.trim()) return res.status(400).json({ message: 'Reset token is required' });
    if (!password)      return res.status(400).json({ message: 'New password is required' });

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    // Hash the incoming raw token to compare with the stored hash
    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: new Date() }, // must not be expired
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    user.password             = password; // pre-save hook hashes it
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    user.isEmailVerified      = true; // proves they own the inbox
    await user.save();

    return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('[resetPassword] Error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate with Google (email is pre-verified)
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { token, role } = req.body;

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch Google user info');

    const { name, email, picture } = await response.json();
    const normalizedEmail = email.toLowerCase().trim(); // BUG FIX: was missing normalization

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const assignedRole = ['citizen', 'responder'].includes(role) ? role : 'citizen';
      user = await User.create({
        name,
        email:           normalizedEmail,
        password:        crypto.randomBytes(32).toString('hex'),
        avatar:          picture,
        role:            assignedRole,
        isEmailVerified: true, // Google already verified this email
      });
    } else if (!user.isEmailVerified) {
      // Mark existing unverified account as verified (user proved ownership via Google)
      user.isEmailVerified = true;
      await user.save();
    }

    return res.json(buildAuthResponse(user));
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(401).json({ message: 'Google authentication failed' });
  }
};
