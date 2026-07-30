import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, FileBarChart, MessageSquare, Settings, LogOut } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/groups', icon: Users, label: 'יצירת קבוצות' },
  { to: '/reports', icon: FileBarChart, label: 'הפקת דוחות' },
  { to: '/chat', icon: MessageSquare, label: "צ'אט AI" },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 glass border-l border-dark-700 flex flex-col">
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <img src={logoSvg} alt="לוגו" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">מחירון חכם</h1>
              <p className="text-xs text-dark-400">השוואת מחירונים</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary-600/20 text-primary-300 border border-primary-500/30' : 'text-dark-300 hover:bg-dark-800 hover:text-white'}`
            }>
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' : 'text-dark-300 hover:bg-dark-800 hover:text-white'}`
            }>
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">ניהול מערכת</span>
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-dark-700">
          <div className="flex items-center justify-between">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-xs text-dark-400">{isAdmin ? 'מנהל' : 'משתמש'}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
