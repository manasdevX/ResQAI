import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a stable room ID for a DM between two users
 * (alphabetical sort so A→B and B→A resolve to the same room)
 */
const dmRoomId = (a, b) =>
  [a.toString(), b.toString()].sort().join('_');

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * @desc  Get all users (for starting a new DM)
 * @route GET /api/chat/users
 * @access Private
 */
export const getChatUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const filter = { _id: { $ne: req.user._id }, isActive: true };
    if (search?.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email role avatar lastSeen')
      .sort({ name: 1 })
      .limit(limit);
    return res.status(200).json({ success: true, users });
  } catch (err) {
    console.error('[getChatUsers]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

/**
 * @desc  Get DM conversation history between current user and another
 * @route GET /api/chat/dm/:userId?page=1
 * @access Private
 */
export const getDMHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const skip  = (page - 1) * limit;

    const messages = await Message.findConversation(
      req.user._id, userId, { limit, skip }
    );

    // Return in chronological order (findConversation returns newest first)
    return res.status(200).json({
      success: true,
      messages: messages.reverse(),
      page,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error('[getDMHistory]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

/**
 * @desc  Send a DM (REST fallback — real-time goes via socket)
 * @route POST /api/chat/dm/:userId
 * @access Private
 */
export const sendDM = async (req, res) => {
  try {
    const { content, replyTo } = req.body;
    const { userId }           = req.params;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send a message to yourself' });
    }
    const recipient = await User.findById(userId).select('_id name');
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const message = await Message.create({
      sender:      req.user._id,
      recipient:   userId,
      messageType: 'direct',
      content:     content.trim(),
      ...(replyTo && { replyTo }),
    });

    const populated = await message.populate([
      { path: 'sender',  select: 'name email role avatar' },
      { path: 'replyTo', select: 'content sender' },
    ]);

    return res.status(201).json({ success: true, message: populated });
  } catch (err) {
    console.error('[sendDM]', err);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

/**
 * @desc  Get incident thread messages
 * @route GET /api/chat/incident/:incidentId?page=1
 * @access Private
 */
export const getIncidentThread = async (req, res) => {
  try {
    const { incidentId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 100;
    const skip  = (page - 1) * limit;

    const messages = await Message.findIncidentThread(incidentId, { limit, skip });

    return res.status(200).json({
      success: true,
      messages,
      page,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error('[getIncidentThread]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch thread' });
  }
};

/**
 * @desc  Post to an incident thread
 * @route POST /api/chat/incident/:incidentId
 * @access Private
 */
export const postToIncidentThread = async (req, res) => {
  try {
    const { content, replyTo } = req.body;
    const { incidentId }       = req.params;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const message = await Message.create({
      sender:      req.user._id,
      incident:    incidentId,
      messageType: 'incident',
      content:     content.trim(),
      ...(replyTo && { replyTo }),
    });

    const populated = await message.populate([
      { path: 'sender',  select: 'name email role avatar' },
      { path: 'replyTo', select: 'content sender' },
    ]);

    return res.status(201).json({ success: true, message: populated });
  } catch (err) {
    console.error('[postToIncidentThread]', err);
    return res.status(500).json({ success: false, message: 'Failed to post to thread' });
  }
};

/**
 * @desc  Mark all DMs from a user as read
 * @route PATCH /api/chat/dm/:userId/read
 * @access Private
 */
export const markDMRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId       = req.user._id;

    // Find all unread messages sent to me by this user
    const unread = await Message.find({
      sender:      userId,
      recipient:   myId,
      messageType: 'direct',
      'readBy.user': { $ne: myId },
    }).select('_id');

    if (unread.length > 0) {
      await Message.updateMany(
        { _id: { $in: unread.map(m => m._id) } },
        { $addToSet: { readBy: { user: myId, readAt: new Date() } } }
      );
    }

    return res.status(200).json({ success: true, marked: unread.length });
  } catch (err) {
    console.error('[markDMRead]', err);
    return res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

/**
 * @desc  Get unread message counts per conversation partner
 * @route GET /api/chat/unread
 * @access Private
 */
export const getUnreadCounts = async (req, res) => {
  try {
    const myId = req.user._id;

    const counts = await Message.aggregate([
      {
        $match: {
          recipient:     myId,
          messageType:   'direct',
          'readBy.user': { $ne: myId },
        },
      },
      {
        $group: {
          _id:   '$sender',
          count: { $sum: 1 },
        },
      },
    ]);

    // Map to { senderId: count }
    const result = {};
    counts.forEach(c => { result[c._id.toString()] = c.count; });

    return res.status(200).json({ success: true, unread: result });
  } catch (err) {
    console.error('[getUnreadCounts]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread counts' });
  }
};

/**
 * @desc  Delete a message (soft delete, sender or admin only)
 * @route DELETE /api/chat/message/:messageId
 * @access Private
 */
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.isDeleted) return res.status(400).json({ success: false, message: 'Message already deleted' });

    const isOwner = message.sender?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content   = '[Message deleted]';
    await message.save();

    return res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error('[deleteMessage]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

// ── Socket.IO chat handler ─────────────────────────────────────────────────────
// Called from server.js: setupChatSocket(io)

export const setupChatSocket = (io) => {

  // Track online users: Map<socketId, { userId, name, role, avatar }>
  const onlineUsers = new Map();

  io.on('connection', (socket) => {

    // Auto-join personal room immediately on connection so targeted events
    // (sosAcknowledged, newIncidentAssigned, incidentEscalated) always reach
    // the right socket regardless of whether chat:join has been called yet.
    if (socket.userId) socket.join(`user:${socket.userId}`);

    // ── Join: register name/role/avatar for this verified socket ────────────
    // socket.userId is already set and verified by server.js JWT middleware
    socket.on('chat:join', ({ name, role, avatar }) => {
      const userId = socket.userId;
      if (!userId) return;

      onlineUsers.set(socket.id, { userId, name, role, avatar, socketId: socket.id });

      // Broadcast updated online users list
      io.emit('chat:onlineUsers', Array.from(onlineUsers.values()));

      // Ensure personal room membership (idempotent — safe to call again)
      socket.join(`user:${userId}`);
    });

    // ── Send DM ───────────────────────────────────────────────────────────────
    socket.on('chat:sendDM', async ({ recipientId, content, replyTo, tempId }) => {
      if (!socket.userId || !content?.trim() || !recipientId) return;
      if (recipientId === socket.userId) return; // prevent self-DM
      if (content.trim().length > 10000) return socket.emit('chat:error', { message: 'Message too long (max 10,000 characters)' });

      try {
        const message = await Message.create({
          sender:      socket.userId,
          recipient:   recipientId,
          messageType: 'direct',
          content:     content.trim(),
          ...(replyTo && { replyTo }),
        });

        const populated = await message.populate([
          { path: 'sender',  select: 'name email role avatar' },
          { path: 'replyTo', select: 'content sender' },
        ]);

        const payload = { ...populated.toJSON(), tempId };

        // Deliver to recipient's personal room
        io.to(`user:${recipientId}`).emit('chat:newDM', payload);
        // Echo back to sender
        io.to(`user:${socket.userId}`).emit('chat:newDM', payload);
      } catch (err) {
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // ── Typing indicator ─────────────────────────────────────────────────────
    socket.on('chat:typing', ({ recipientId, isTyping }) => {
      if (!socket.userId) return;
      const user = onlineUsers.get(socket.id);
      io.to(`user:${recipientId}`).emit('chat:typing', {
        senderId: socket.userId,
        name:     user?.name || 'Someone',
        isTyping,
      });
    });

    // ── Join incident thread room ─────────────────────────────────────────────
    socket.on('chat:joinIncident', (incidentId) => {
      socket.join(`incident:${incidentId}`);
    });

    socket.on('chat:leaveIncident', (incidentId) => {
      socket.leave(`incident:${incidentId}`);
    });

    // ── Send incident thread message ──────────────────────────────────────────
    socket.on('chat:incidentMessage', async ({ incidentId, content, replyTo, tempId }) => {
      if (!socket.userId || !content?.trim() || !incidentId) return;
      if (content.trim().length > 10000) return socket.emit('chat:error', { message: 'Message too long (max 10,000 characters)' });

      try {
        const message = await Message.create({
          sender:      socket.userId,
          incident:    incidentId,
          messageType: 'incident',
          content:     content.trim(),
          ...(replyTo && { replyTo }),
        });

        const populated = await message.populate([
          { path: 'sender',  select: 'name email role avatar' },
          { path: 'replyTo', select: 'content sender' },
        ]);

        io.to(`incident:${incidentId}`).emit('chat:incidentMessage', {
          ...populated.toJSON(),
          tempId,
        });
      } catch (err) {
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      io.emit('chat:onlineUsers', Array.from(onlineUsers.values()));
    });
  });
};
