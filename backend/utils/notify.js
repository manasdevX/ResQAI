import Notification from '../models/Notification.js';
import { io } from '../server.js';

/**
 * Persist a notification to the DB and emit it to the recipient's socket room.
 * Never throws — errors are logged silently so callers don't need try/catch.
 */
export const notify = async (recipientId, { type = 'system', title, body, link }) => {
  try {
    const notif = await Notification.create({ recipient: recipientId, type, title, body, link });
    io.to(`user:${recipientId}`).emit('notification', notif);
    return notif;
  } catch (err) {
    console.error('[notify]', err.message);
  }
};
