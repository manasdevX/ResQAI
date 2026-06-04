import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { api, user } = useAuth();
  const socket = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=30');
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Live: push incoming notification to the top of the list
  useEffect(() => {
    if (!socket) return;
    const onNotification = (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [socket]);

  const markRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, [api]);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, [api]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, loading,
      markRead, markAllRead, fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
};
