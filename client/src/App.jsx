import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: 'blur(4px)' },
  enter: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, y: -8, filter: 'blur(2px)',
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

function PageTransition({ children }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2EC4B6] border-t-transparent" />
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
              <Route path="/login" element={
                <PageTransition><Login /></PageTransition>
              } />
              <Route path="/invite/:token" element={
                <PageTransition><InviteAccept /></PageTransition>
              } />
              <Route path="/share/:token" element={
                <PageTransition><ShareViewPage /></PageTransition>
              } />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={
                  <PageTransition><Dashboard /></PageTransition>
                } />
                <Route path="/projects/:id" element={
                  <PageTransition><ProjectDetail /></PageTransition>
                } />
                <Route path="/admin" element={
                  <PageTransition><Admin /></PageTransition>
                } />
                <Route path="/profile" element={
                  <PageTransition><Profile /></PageTransition>
                } />
                <Route path="/calendar" element={
                  <PageTransition><CalendarPage /></PageTransition>
                } />
                <Route path="/chat" element={
                  <PageTransition><ChatPage /></PageTransition>
                } />
                <Route path="/notifications" element={
                  <PageTransition><NotificationsPage /></PageTransition>
                } />
                <Route path="/pages/:id" element={
                  <PageTransition><PageEditorPage /></PageTransition>
                } />
                <Route path="/tasks/:id" element={
                  <PageTransition><TaskFullPagePage /></PageTransition>
                } />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ToastProviderWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}
