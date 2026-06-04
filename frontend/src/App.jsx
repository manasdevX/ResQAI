import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

// Layouts
import AdminLayout     from './layouts/AdminLayout';
import VolunteerLayout from './layouts/VolunteerLayout';
import CitizenLayout   from './layouts/CitizenLayout';

// Public pages (Keep sync for fast initial render)
import Login          from './pages/Login';
import Signup         from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import NotFound       from './pages/NotFound';

// ── Lazy Loaded Pages ─────────────────────────────────────────────────────────

// Admin pages
const AdminDashboard      = lazy(() => import('./pages/admin/Dashboard'));
const AdminIncidentManager = lazy(() => import('./pages/admin/IncidentManager'));
const AdminShelterManager  = lazy(() => import('./pages/admin/ShelterManager'));
const AdminAlerts         = lazy(() => import('./pages/admin/Alerts'));
const AdminAnalytics      = lazy(() => import('./pages/admin/Analytics'));
const AdminInvites        = lazy(() => import('./pages/admin/Invites'));
const AdminUserManager    = lazy(() => import('./pages/admin/UserManager'));

// Volunteer pages
const VolunteerDashboard     = lazy(() => import('./pages/volunteer/Dashboard'));
const VolunteerIncidents     = lazy(() => import('./pages/volunteer/Incidents'));
const VolunteerAssignments   = lazy(() => import('./pages/volunteer/Assignments'));
const VolunteerResources     = lazy(() => import('./pages/volunteer/Resources'));

// Citizen pages
const CitizenHome        = lazy(() => import('./pages/citizen/Home'));
const CitizenResources   = lazy(() => import('./pages/citizen/Resources'));
const CitizenMyReports   = lazy(() => import('./pages/citizen/MyReports'));
const IncidentDetail     = lazy(() => import('./pages/citizen/IncidentDetail'));

// Shared pages
const Profile        = lazy(() => import('./pages/Profile'));
const Report         = lazy(() => import('./pages/Report'));
const Shelters       = lazy(() => import('./pages/Shelters'));
const Chat           = lazy(() => import('./pages/Chat'));
const Notifications  = lazy(() => import('./pages/Notifications'));

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
      <NotificationProvider>
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <OfflineBanner />
          <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>}>
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
                  <Route path="/admin/users"      element={<AdminUserManager />} />
                  <Route path="/admin/chat"       element={<Chat />} />
                  <Route path="/admin/profile"    element={<Profile />} />
                </Route>
              </Route>

              {/* ── Volunteer (responder only) ──────────────────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['responder']} />}>
                <Route element={<VolunteerLayout />}>
                  <Route path="/volunteer"              element={<VolunteerDashboard />} />
                  <Route path="/volunteer/incidents"   element={<VolunteerIncidents />} />
                  <Route path="/volunteer/assignments" element={<VolunteerAssignments />} />
                  <Route path="/volunteer/resources"   element={<VolunteerResources />} />
                  <Route path="/volunteer/chat"        element={<Chat />} />
                  <Route path="/volunteer/profile"     element={<Profile />} />
                </Route>
              </Route>

              {/* ── Citizen ─────────────────────────────────────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['citizen']} />}>
                <Route element={<CitizenLayout />}>
                  <Route path="/home"              element={<CitizenHome />} />
                  <Route path="/report"            element={<Report />} />
                  <Route path="/shelters"           element={<Shelters />} />
                  <Route path="/resources"          element={<CitizenResources />} />
                  <Route path="/my-reports"         element={<CitizenMyReports />} />
                  <Route path="/chat"               element={<Chat />} />
                  <Route path="/profile"            element={<Profile />} />
                </Route>
              </Route>

              {/* ── Shared incident detail — all authenticated roles ─────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['citizen', 'responder', 'admin']} />}>
                <Route path="/incidents/:id" element={<IncidentDetail />} />
                {/* Notifications is a single shared route for ALL roles — previously
                    duplicated under the volunteer + citizen layouts, where the
                    volunteer-guarded copy shadowed the others and bounced citizens/admins. */}
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              {/* ── 404 ─────────────────────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
