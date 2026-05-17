import crypto from 'crypto';
import Invite from '../models/Invite.js';

// @desc   Create an invite link (admin only)
// @route  POST /api/invites
// @access Private (admin)
export const createInvite = async (req, res) => {
  try {
    const { email, role } = req.body;
    const VALID_ROLES = ['admin', 'shelter_manager'];

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const invite = await Invite.create({
      email:     email?.toLowerCase().trim() || '',
      role,
      token,
      createdBy: req.user._id,
      expiresAt,
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/signup?invite=${token}`;

    return res.status(201).json({ success: true, invite, inviteUrl });
  } catch (error) {
    console.error('[createInvite]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Validate an invite token (called from signup page)
// @route  GET /api/invites/validate?token=
// @access Public
export const validateInvite = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const invite = await Invite.findOne({ token, usedAt: null });

    if (!invite) {
      return res.status(404).json({ success: false, valid: false, message: 'Invalid or already used invite' });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ success: false, valid: false, message: 'This invite has expired' });
    }

    return res.json({
      success: true,
      valid:   true,
      role:    invite.role,
      email:   invite.email || null,
    });
  } catch (error) {
    console.error('[validateInvite]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   List all invites created by this admin
// @route  GET /api/invites
// @access Private (admin)
export const listInvites = async (req, res) => {
  try {
    const invites = await Invite.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('usedBy', 'name email');

    return res.json({ success: true, invites });
  } catch (error) {
    console.error('[listInvites]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Delete / revoke an invite
// @route  DELETE /api/invites/:id
// @access Private (admin)
export const deleteInvite = async (req, res) => {
  try {
    const invite = await Invite.findOneAndDelete({
      _id:       req.params.id,
      createdBy: req.user._id,
      usedAt:    null,
    });

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found or already used' });
    }

    return res.json({ success: true, message: 'Invite revoked' });
  } catch (error) {
    console.error('[deleteInvite]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
