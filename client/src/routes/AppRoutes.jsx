import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { PageSkeleton, AppSplash } from '../components/ui';

// Route-level code splitting: each page becomes its own chunk, fetched only
// when its route is visited, instead of one large bundle shipped upfront.
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const OrganizationPage = lazy(() => import('../pages/organization/OrganizationPage'));
const DepartmentsPage = lazy(() => import('../pages/departments/DepartmentsPage'));
const DesignationsPage = lazy(() => import('../pages/designations/DesignationsPage'));
const EmployeesListPage = lazy(() => import('../pages/employees/EmployeesListPage'));
const EmployeeFormPage = lazy(() => import('../pages/employees/EmployeeFormPage'));
const EmployeeDetailPage = lazy(() => import('../pages/employees/EmployeeDetailPage'));
const AttendancePage = lazy(() => import('../pages/attendance/AttendancePage'));
const TeamAttendancePage = lazy(() => import('../pages/attendance/TeamAttendancePage'));
const MyLeavesPage = lazy(() => import('../pages/leave/MyLeavesPage'));
const LeaveApprovalsPage = lazy(() => import('../pages/leave/LeaveApprovalsPage'));
const MyPayrollPage = lazy(() => import('../pages/payroll/MyPayrollPage'));
const PayrollManagementPage = lazy(() => import('../pages/payroll/PayrollManagementPage'));
const PayslipPage = lazy(() => import('../pages/payroll/PayslipPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const AuditLogsPage = lazy(() => import('../pages/auditLogs/AuditLogsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const HR = ['HR_ADMIN', 'SUPER_ADMIN'];
const LEADS = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <Suspense fallback={null}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={null}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />
        <Route
          path="/reset-password"
          element={
            <Suspense fallback={null}>
              <ResetPasswordPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route element={<SuspendedOutlet />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/designations" element={<DesignationsPage />} />
            <Route path="/employees" element={<EmployeesListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leaves" element={<MyLeavesPage />} />
            <Route path="/payroll" element={<MyPayrollPage />} />
            <Route path="/payroll/:id" element={<PayslipPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<RoleRoute allowed={LEADS} />}>
              <Route path="/attendance/team" element={<TeamAttendancePage />} />
              <Route path="/leaves/approvals" element={<LeaveApprovalsPage />} />
            </Route>

            <Route element={<RoleRoute allowed={HR} />}>
              <Route path="/payroll/manage" element={<PayrollManagementPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/employees/new" element={<EmployeeFormPage />} />
              <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="*"
        element={
          <Suspense fallback={<AppSplash />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  );
}

// Suspense boundary *inside* the layout so lazy page chunks show a page
// skeleton in the content area while the sidebar/header stay put.
function SuspendedOutlet() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  );
}
