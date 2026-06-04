import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  // AuthContext renders a full-screen spinner while loading, so by the time
  // ProtectedRoute mounts, loading will always be false. Guard kept for safety.
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = user.role === 'admin' ? '/admin'
               : user.role === 'responder' ? '/volunteer'
               : '/home';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
