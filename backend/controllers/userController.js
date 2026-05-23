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
