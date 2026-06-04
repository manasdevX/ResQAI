import { useSocketStatus, useSocketConnecting } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const { user } = useAuth();
  const isConnected = useSocketStatus();
  const isConnecting = useSocketConnecting();

  // Don't flash during the initial handshake after login
  if (!user || isConnected || isConnecting) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center bg-red-600/90 backdrop-blur-sm px-4 py-2 text-white text-sm font-medium shadow-lg animate-fade-in">
      <WifiOff className="w-4 h-4 mr-2 animate-pulse" />
      <span>Connection lost. Reconnecting...</span>
    </div>
  );
}
