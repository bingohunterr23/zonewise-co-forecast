import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Home, Activity, TrendingUp, Map, Leaf, TreePine, Footprints,
  LogOut, Menu, X, Bell, MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/dashboard/live', label: 'Live Monitoring', icon: Activity },
  { to: '/dashboard/predict', label: 'CO₂ Prediction', icon: TrendingUp },
  { to: '/dashboard/map', label: 'Area Visualization', icon: Map },
  { to: '/dashboard/green-cover', label: 'Green Cover', icon: Leaf },
  { to: '/dashboard/tree-impact', label: 'Tree Impact', icon: TreePine },
  { to: '/dashboard/carbon-footprint', label: 'Carbon Footprint', icon: Footprints },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      await navigate({ to: '/login', replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-eco-100 fixed h-full z-30">
        <SidebarContent onLogout={handleLogout} userName={user?.full_name || user?.email || ''} onNavigateClose={() => setMobileOpen(false)} />
      </aside>

      {/* Sidebar - Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-eco-950/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white border-r border-eco-100 flex flex-col animate-slide-up">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-eco-400 hover:text-eco-700">
              <X size={20} />
            </button>
            <SidebarContent onLogout={handleLogout} userName={user?.full_name || user?.email || ''} onNavigateClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-eco-100 sticky top-0 z-20">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden text-eco-700 hover:text-eco-900"
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-2 text-eco-600">
                <MapPin size={16} />
                <span className="text-sm font-medium text-eco-800">Bengaluru</span>
                <span className="text-eco-300">|</span>
                <span className="text-sm text-eco-500">8 Zones Active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-eco-500">
                <div className="w-2 h-2 rounded-full bg-eco-500 animate-pulse-soft" />
                <span>System Online</span>
              </div>
              <button className="relative p-2 rounded-lg hover:bg-warm-100 transition-colors">
                <Bell size={18} className="text-eco-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-clay-400" />
              </button>
              <div className="w-8 h-8 rounded-full bg-eco-600 text-white flex items-center justify-center text-sm font-medium">
                {(user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onLogout, userName, onNavigateClose }: { onLogout: () => void; userName: string; onNavigateClose?: () => void }) {
  return (
    <>
      <div className="p-5 border-b border-eco-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-eco-500 to-eco-700 flex items-center justify-center shadow-sm">
            <Leaf size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-eco-900 text-base leading-tight">UrbanEcoSense</h1>
            <p className="text-xs text-eco-400">Bengaluru Zones</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.end ?? false }}
            onClick={() => { if (window.innerWidth < 1024) onNavigateClose?.(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-eco-500 hover:bg-warm-50 hover:text-eco-700"
            activeProps={{ className: 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-eco-50 text-eco-700 shadow-sm' }}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-eco-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-eco-400 truncate">{userName}</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-clay-500 hover:bg-clay-50 transition-all duration-200"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </>
  );
}
