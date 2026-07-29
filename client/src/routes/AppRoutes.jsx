import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import LoginPage from '../pages/auth/LoginPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import OrganizationPage from '../pages/organization/OrganizationPage';
import DepartmentsPage from '../pages/departments/DepartmentsPage';
import DesignationsPage from '../pages/designations/DesignationsPage';
import EmployeesListPage from '../pages/employees/EmployeesListPage';
import EmployeeFormPage from '../pages/employees/EmployeeFormPage';
import EmployeeDetailPage from '../pages/employees/EmployeeDetailPage';
import AttendancePage from '../pages/attendance/AttendancePage';
import TeamAttendancePage from '../pages/attendance/TeamAttendancePage';
import MyLeavesPage from '../pages/leave/MyLeavesPage';
import LeaveApprovalsPage from '../pages/leave/LeaveApprovalsPage';
import MyPayrollPage from '../pages/payroll/MyPayrollPage';
import PayrollManagementPage from '../pages/payroll/PayrollManagementPage';
import ProfilePage from '../pages/profile/ProfilePage';
import AuditLogsPage from '../pages/auditLogs/AuditLogsPage';
import NotFoundPage from '../pages/NotFoundPage';

// As each phase is built, its pages get added here (Employees in Phase 5,
// Attendance in Phase 6, Leave in Phase 7, Payroll in Phase 8, etc.), each
// optionally wrapped in <RoleRoute allowed={[...]} /> per the RBAC matrix.
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/designations" element={<DesignationsPage />} />
          <Route path="/employees" element={<EmployeesListPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leaves" element={<MyLeavesPage />} />
          <Route path="/payroll" element={<MyPayrollPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<RoleRoute allowed={['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER']} />}>
            <Route path="/attendance/team" element={<TeamAttendancePage />} />
            <Route path="/leaves/approvals" element={<LeaveApprovalsPage />} />
          </Route>

          <Route element={<RoleRoute allowed={['HR_ADMIN', 'SUPER_ADMIN']} />}>
            <Route path="/payroll/manage" element={<PayrollManagementPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
