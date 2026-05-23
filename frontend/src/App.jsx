import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts
import AdminLayout     from './layouts/AdminLayout';
import VolunteerLayout from './layouts/VolunteerLayout';
import CitizenLayout   from './layouts/CitizenLayout';

// Public pages
import Login          from './pages/Login';
import Signup         from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import NotFound       from './pages/NotFound';

// Admin pages
import AdminDashboard      from './pages/admin/Dashboard';
import AdminIncidentManager from './pages/admin/IncidentManager';
import AdminShelterManager  from './pages/admin/ShelterManager';
import AdminAlerts         from './pages/admin/Alerts';
import AdminAnalytics      from './pages/admin/Analytics';
import AdminInvites        from './pages/admin/Invites';

// Volunteer pages
import VolunteerDashboard   from './pages/volunteer/Dashboard';
import VolunteerIncidents   from './pages/volunteer/Incidents';
import VolunteerAssignments from './pages/volunteer/Assignments';
import VolunteerResources   from './pages/volunteer/Resources';

// Citizen pages
import CitizenHome      from './pages/citizen/Home';
import CitizenResources from './pages/citizen/Resources';
import CitizenMyReports from './pages/citizen/MyReports';

// Shared pages
import Report   from './pages/Report';
import Shelters from './pages/Shelters';
import Chat     from './pages/Chat';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <Routes>
            {/* ── Public ──────────────────────────────────────────────────────── */}
            <Route path="/"                 element={<Navigate to="/login" replace />} />
            <Route path="/login"            element={<Login />} />
            <Route path="/signup"           element={<Signup />} />
            <Route path="/forgot-password"  element={<ForgotPassword />} />
            <Route path="/reset-password"   element={<ResetPassword />} />

            {/* ── Admin ───────────────────────────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin"            element={<AdminDashboard />} />
                <Route path="/admin/incidents"  element={<AdminIncidentManager />} />
                <Route path="/admin/shelters"   element={<AdminShelterManager />} />
                <Route path="/admin/alerts"     element={<AdminAlerts />} />
                <Route path="/admin/analytics"  element={<AdminAnalytics />} />
                <Route path="/admin/invites"    element={<AdminInvites />} />
                <Route path="/admin/chat"       element={<Chat />} />
              </Route>
            </Route>

            {/* ── Volunteer / Shelter Manager ──────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['responder', 'shelter_manager']} />}>
              <Route element={<VolunteerLayout />}>
                <Route path="/volunteer"             element={<VolunteerDashboard />} />
                <Route path="/volunteer/incidents"   element={<VolunteerIncidents />} />
                <Route path="/volunteer/assignments" element={<VolunteerAssignments />} />
                <Route path="/volunteer/resources"   element={<VolunteerResources />} />
                <Route path="/volunteer/chat"        element={<Chat />} />
              </Route>
            </Route>

            {/* ── Citizen ─────────────────────────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['citizen']} />}>
              <Route element={<CitizenLayout />}>
                <Route path="/home"        element={<CitizenHome />} />
                <Route path="/report"      element={<Report />} />
                <Route path="/shelters"    element={<Shelters />} />
                <Route path="/resources"   element={<CitizenResources />} />
                <Route path="/my-reports"  element={<CitizenMyReports />} />
                <Route path="/chat"        element={<Chat />} />
              </Route>
            </Route>

            {/* ── 404 ─────────────────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
