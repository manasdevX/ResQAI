import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Routes for all authenticated users */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/report" element={<Report />} />
            </Route>
            
            {/* Example of Role-based protection:
            <Route element={<ProtectedRoute allowedRoles={['admin', 'shelter_manager']} />}>
               <Route path="/admin" element={<AdminPanel />} />
            </Route>
            */}
          </Routes>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
