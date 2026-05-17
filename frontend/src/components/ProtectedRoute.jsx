import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = user.role === 'admin' ? '/admin'
               : user.role === 'responder' || user.role === 'shelter_manager' ? '/volunteer'
               : '/home';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
