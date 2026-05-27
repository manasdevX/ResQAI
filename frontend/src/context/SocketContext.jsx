import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext)?.socket || null;
export const useSocketStatus = () => useContext(SocketContext)?.isConnected || false;

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect when authenticated
    if (!user || !token) {
      // Disconnect if previously connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const _rawSocket = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socketUrl = _rawSocket.startsWith('http://') || _rawSocket.startsWith('https://')
      ? _rawSocket.trim()
      : `https://${_rawSocket.trim()}`;
    const s = io(socketUrl, {
      auth:        { token },           // send JWT so server can validate if needed
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect',       () => setIsConnected(true));
    s.on('disconnect',    () => setIsConnected(false));
    s.on('connect_error', () => setIsConnected(false));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // Re-connect when user / token changes (login/logout)
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
