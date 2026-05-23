import Notification from '../models/Notification.js';

// @desc   Get my notifications (paginated, newest first)
// @route  GET /api/notifications
// @access Private
export const getNotifications = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);

    return res.json({ success: true, notifications, total, unreadCount, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('[getNotifications]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// @desc   Mark a single notification as read
// @route  PATCH /api/notifications/:id/read
// @access Private
export const markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[markOneRead]', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};

// @desc   Mark all notifications as read
// @route  PATCH /api/notifications/read-all
// @access Private
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('[markAllRead]', error);
    return res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
};
