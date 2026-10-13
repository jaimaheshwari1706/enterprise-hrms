import { Outlet, Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import '../pages/auth/neumorphic.css';

export default function AuthLayout() {
  return (
    <div className="neu-auth-body">
      {/* Top Window Bar */}
      <div className="neu-window-header">
        <Link to="/login" className="neu-window-title hover:opacity-80 transition-opacity">
          <Home size={15} className="text-[#E88A7A]" />
          <span>HRONE</span>
        </Link>
        <Link to="/login" className="neu-button neu-button-sm">
          Back to Login
        </Link>
      </div>

      {/* Neumorphic Card container for Forgot / Reset Password */}
      <div className="neu-card-container !min-h-0 !w-[500px] !max-w-full p-8 md:p-12 flex flex-col items-center">
        <div className="neu-badge">
          <Home size={16} className="neu-badge-icon" />
          <span>HRM</span>
        </div>
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
