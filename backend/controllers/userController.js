import { User } from '../models/index.js';
import { io } from '../server.js';

// @desc   Toggle volunteer availability (ON/OFF DUTY)
// @route  PATCH /api/users/availability
// @access Private
export const toggleAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isAvailable = !user.isAvailable;
    await user.save();

    // Notify all admins so their dashboards reflect the change in real-time
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    admins.forEach(a =>
      io.to(`user:${a._id}`).emit('responderAvailabilityChanged', {
        responderId:   user._id,
        responderName: user.name,
        isAvailable:   user.isAvailable,
      })
    );

    return res.json({
      success:     true,
      isAvailable: user.isAvailable,
      message:     user.isAvailable ? 'You are now ON DUTY' : 'You are now OFF DUTY',
    });
  } catch (error) {
    console.error('[toggleAvailability]', error);
    return res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
};

// @desc   Mark the current user as safe
// @route  PATCH /api/users/safe
// @access Private
export const markSafe = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isSafe: true });

    return res.json({
      success: true,
      message: 'You have been marked as safe',
    });
  } catch (error) {
    console.error('[markSafe]', error);
    return res.status(500).json({ success: false, message: 'Failed to mark safe' });
  }
};

// @desc   Update volunteer skills
// @route  PATCH /api/users/skills
// @access Private
export const updateSkills = async (req, res) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({ success: false, message: 'skills must be an array of strings' });
    }

    const cleaned = skills
      .map(s => String(s).trim().toLowerCase())
      .filter(s => s.length > 0)
      .slice(0, 20); // cap at 20 skills

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { skills: cleaned },
      { new: true }
    );

    return res.json({ success: true, skills: user.skills });
  } catch (error) {
    console.error('[updateSkills]', error);
    return res.status(500).json({ success: false, message: 'Failed to update skills' });
  }
};

// @desc   Get all available responders (for admin)
// @route  GET /api/users/responders
// @access Private (admin)
export const getAvailableResponders = async (req, res) => {
  try {
    const responders = await User.find({
      role:        { $in: ['responder', 'admin'] },
      isAvailable: true,
    }).select('name email avatar skills isAvailable location');

    return res.json({ success: true, count: responders.length, responders });
  } catch (error) {
    console.error('[getAvailableResponders]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch responders' });
  }
};

// @desc   Get own profile
// @route  GET /api/users/profile
// @access Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name email phone avatar role skills isAvailable isSafe isActive createdAt lastSeen');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    console.error('[getProfile]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// @desc   Update own profile (name, phone)
// @route  PATCH /api/users/profile
// @access Private
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
    }
    if (phone !== undefined && phone && !/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }

    const updates = {};
    if (name  !== undefined) updates.name  = String(name).trim();
    if (phone !== undefined) updates.phone = phone ? String(phone).trim() : undefined;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('name email phone avatar role skills');

    return res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    console.error('[updateProfile]', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// @desc   Upload / replace avatar image
// @route  PATCH /api/users/avatar
// @access Private
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path }, // Cloudinary secure URL
      { new: true }
    ).select('name email avatar');

    return res.json({ success: true, message: 'Avatar updated', avatar: user.avatar, user });
  } catch (error) {
    console.error('[uploadAvatar]', error);
    return res.status(500).json({ success: false, message: 'Failed to upload avatar' });
  }
};

// @desc   Get all users (paginated, searchable)
// @route  GET /api/users/all
// @access Private (admin)
export const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email phone avatar role skills isActive isAvailable createdAt lastSeen')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      users,
      total,
      page,
      pages:   Math.ceil(total / limit),
      hasMore: skip + users.length < total,
    });
  } catch (error) {
    console.error('[getAllUsers]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// @desc   Change own password
// @route  PATCH /api/users/password
// @access Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    // Password strength: 8+ chars, upper, lower, digit, special
    const strongEnough = (p) =>
      p.length >= 8 &&
      /[A-Z]/.test(p) &&
      /[a-z]/.test(p) &&
      /\d/.test(p) &&
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p);

    if (!strongEnough(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must differ from your current password' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[changePassword]', error);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// @desc   Change a user's role
// @route  PATCH /api/users/:id/role
// @access Private (admin)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const VALID_ROLES = ['citizen', 'responder', 'shelter_manager'];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    const target = await User.findById(id);
    if (!target)               return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot change another admin\'s role' });

    target.role = role;
    await target.save();

    return res.json({ success: true, message: `Role changed to ${role}`, user: { _id: target._id, role: target.role } });
  } catch (error) {
    console.error('[updateUserRole]', error);
    return res.status(500).json({ success: false, message: 'Failed to update role' });
  }
};

// @desc   Activate or deactivate a user account
// @route  PATCH /api/users/:id/active
// @access Private (admin)
export const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate yourself' });
    }

    const target = await User.findById(id);
    if (!target)               return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot deactivate another admin' });

    target.isActive = !target.isActive;
    await target.save();

    return res.json({
      success:  true,
      isActive: target.isActive,
      message:  target.isActive ? 'Account activated' : 'Account deactivated',
    });
  } catch (error) {
    console.error('[toggleUserActive]', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle account status' });
  }
};
