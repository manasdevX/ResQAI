import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth(); // Assume we have a user context

  useEffect(() => {
    // Only connect if the user is authenticated (optional, depends on your use case)
    if (user) {
      const newSocket = io('http://localhost:5000', {
        // You can pass auth token here if needed
        // auth: { token: localStorage.getItem('token') }
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to Socket.IO server', newSocket.id);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
