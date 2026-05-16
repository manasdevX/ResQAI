import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect when authenticated
    if (!user || !token) {
      // Disconnect if previously connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const s = io('http://localhost:5000', {
      auth:        { token },           // send JWT so server can validate if needed
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () =>
      console.log('[Socket] Connected:', s.id)
    );
    s.on('disconnect', (reason) =>
      console.log('[Socket] Disconnected:', reason)
    );
    s.on('connect_error', (err) =>
      console.warn('[Socket] Connection error:', err.message)
    );

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // Re-connect when user / token changes (login/logout)
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
