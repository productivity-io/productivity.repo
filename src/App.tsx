import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { EchoAssistant } from './components/EchoAssistant';

// Lazy-loaded modules for optimal bundle splitting and fast navigation
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const TimetablePage = lazy(() => import('./pages/TimetablePage').then(m => ({ default: m.TimetablePage })));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then(m => ({ default: m.AssignmentsPage })));
const ExaminationsPage = lazy(() => import('./pages/ExaminationsPage').then(m => ({ default: m.ExaminationsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const TransportPage = lazy(() => import('./pages/TransportPage').then(m => ({ default: m.TransportPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));
const LostAndFoundPage = lazy(() => import('./pages/LostAndFoundPage').then(m => ({ default: m.LostAndFoundPage })));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage').then(m => ({ default: m.LeaveRequestsPage })));
const CalendarEventsPage = lazy(() => import('./pages/CalendarEventsPage').then(m => ({ default: m.CalendarEventsPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })));
const CommunicationPage = lazy(() => import('./pages/CommunicationPage').then(m => ({ default: m.CommunicationPage })));
const StudentsStaffPage = lazy(() => import('./pages/StudentsStaffPage').then(m => ({ default: m.StudentsStaffPage })));
const ReportsSettingsPage = lazy(() => import('./pages/ReportsSettingsPage').then(m => ({ default: m.ReportsSettingsPage })));

function ModuleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-white rounded-2xl border border-slate-200" />
      <div className="h-80 bg-white rounded-2xl border border-slate-200" />
    </div>
  );
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Loading Veritas Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppShell>
      <Suspense fallback={<ModuleSkeleton />}>{children}</Suspense>
    </AppShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter useTransitions={false}>
        <EchoAssistant />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
          <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
          <Route path="/examinations" element={<ProtectedRoute><ExaminationsPage /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
          <Route path="/transport" element={<ProtectedRoute><TransportPage /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
          <Route path="/lost-and-found" element={<ProtectedRoute><LostAndFoundPage /></ProtectedRoute>} />
          <Route path="/leave-requests" element={<ProtectedRoute><LeaveRequestsPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarEventsPage /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/communication" element={<ProtectedRoute><CommunicationPage /></ProtectedRoute>} />
          <Route
            path="/directory"
            element={<ProtectedRoute allowedRoles={['teacher', 'coordinator', 'principal']}><StudentsStaffPage /></ProtectedRoute>}
          />
          <Route
            path="/students"
            element={<ProtectedRoute allowedRoles={['teacher', 'coordinator', 'principal']}><StudentsStaffPage /></ProtectedRoute>}
          />
          <Route
            path="/staff"
            element={<ProtectedRoute allowedRoles={['teacher', 'coordinator', 'principal']}><StudentsStaffPage /></ProtectedRoute>}
          />
          <Route
            path="/reports"
            element={<ProtectedRoute allowedRoles={['teacher', 'coordinator', 'principal']}><ReportsSettingsPage /></ProtectedRoute>}
          />
          <Route path="/settings" element={<ProtectedRoute><ReportsSettingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ReportsSettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
