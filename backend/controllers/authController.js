import { User } from '../models/index.js';
import Invite from '../models/Invite.js';
import generateToken from '../utils/generateToken.js';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const signupUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, inviteToken } = req.body;

    if (!name?.trim())  return res.status(400).json({ message: 'Full name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!password)      return res.status(400).json({ message: 'Password is required' });

    // Determine role — citizens and responders can self-register; admins/shelter_managers need invite
    let assignedRole = ['citizen', 'responder'].includes(role) ? role : 'citizen';

    if (inviteToken) {
      const invite = await Invite.findOne({ token: inviteToken, usedAt: null });

      if (!invite) {
        return res.status(400).json({ message: 'Invalid or already used invite link' });
      }
      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ message: 'This invite link has expired' });
      }
      if (invite.email && invite.email !== email.toLowerCase().trim()) {
        return res.status(400).json({ message: 'This invite was sent to a different email address' });
      }

      assignedRole = invite.role;
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,
      role:     assignedRole,
      phone:    phone?.trim(),
    });

    // Mark invite as used
    if (inviteToken) {
      await Invite.findOneAndUpdate(
        { token: inviteToken },
        { usedAt: new Date(), usedBy: user._id }
      );
    }

    return res.status(201).json({
      _id:   user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      avatar:      user.avatar,
      skills:      user.skills,
      isAvailable: user.isAvailable,
      isSafe:      user.isSafe,
      token:       generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user data
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate with Google
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

    let user = await User.findOne({ email });

    if (!user) {
      const assignedRole = ['citizen', 'responder'].includes(role) ? role : 'citizen';
      user = await User.create({
        name,
        email,
        password: crypto.randomBytes(32).toString('hex'),
        avatar:   picture,
        role:     assignedRole,
      });
    }

    return res.json({
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      avatar:      user.avatar,
      skills:      user.skills,
      isAvailable: user.isAvailable,
      isSafe:      user.isSafe,
      token:       generateToken(user._id),
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(401).json({ message: 'Google authentication failed' });
  }
};
