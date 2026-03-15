import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProviderWrapper } from '@/hooks/useToast';
import { Layout } from '@/components/Layout';

const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail').then((m) => ({ default: m.ProjectDetail })));
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const CalendarPage = lazy(() => import('@/pages/Calendar').then((m) => ({ default: m.Calendar })));
const ChatPage = lazy(() => import('@/pages/Chat').then((m) => ({ default: m.Chat })));
const InviteAccept = lazy(() => import('@/pages/InviteAccept').then((m) => ({ default: m.InviteAccept })));
const ShareViewPage = lazy(() => import('@/pages/ShareView').then((m) => ({ default: m.ShareView })));
const NotificationsPage = lazy(() => import('@/pages/Notifications').then((m) => ({ default: m.Notifications })));
const PageEditorPage = lazy(() => import('@/pages/PageEditor').then((m) => ({ default: m.PageEditor })));
const TaskFullPagePage = lazy(() => import('@/pages/TaskFullPage').then((m) => ({ default: m.TaskFullPage })));

function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProviderWrapper>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/invite/:token" element={<InviteAccept />} />
              <Route path="/share/:token" element={<ShareViewPage />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/pages/:id" element={<PageEditorPage />} />
                <Route path="/tasks/:id" element={<TaskFullPagePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ToastProviderWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}
