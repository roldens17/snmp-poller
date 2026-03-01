import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Webhook, 
  FileText, 
  LogOut,
  Server,
  Menu,
  Network,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

export function Root() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const session = await authAPI.getSession();
      if (session.user && session.tenant) {
        setUser(session.user);
        setTenant(session.tenant);
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Session check error:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await authAPI.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-midnight-bg text-midnight-text-primary">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Devices', href: '/devices', icon: Server },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
    { name: 'Webhooks', href: '/webhooks', icon: Webhook },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'SNMP Console', href: '/snmp/switches', icon: Network },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-midnight-accent text-midnight-text-primary'
                : 'text-midnight-text-secondary hover:bg-midnight-bg hover:text-midnight-text-primary'
            }`}
          >
            <Icon className="w-5 h-5" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-midnight-bg text-midnight-text-primary">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-midnight-card border-r border-midnight-border">
        <div className="flex items-center gap-2 h-16 px-6 border-b border-midnight-border bg-midnight-card">
          <Activity className="w-8 h-8 text-midnight-accent" />
          <div className="flex flex-col">
            <span className="text-midnight-text-primary font-bold text-lg">NetMonitor</span>
            <span className="text-midnight-text-secondary text-xs">{tenant?.name}</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-midnight-border">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-midnight-text-primary text-sm font-medium">{user?.name}</span>
              <span className="text-midnight-text-secondary text-xs">{user?.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-midnight-text-secondary hover:text-midnight-text-primary"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="fixed top-4 left-4 z-50 bg-midnight-card border border-midnight-border text-midnight-text-primary"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-midnight-card border-midnight-border text-midnight-text-primary">
            <div className="flex items-center gap-2 mb-8">
              <Activity className="w-8 h-8 text-midnight-accent" />
              <div className="flex flex-col">
                <span className="text-midnight-text-primary font-bold text-lg">NetMonitor</span>
                <span className="text-midnight-text-secondary text-xs">{tenant?.name}</span>
              </div>
            </div>
            <nav className="space-y-1">
              <NavLinks mobile />
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="p-4 bg-midnight-bg border border-midnight-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-midnight-text-primary text-sm font-medium">{user?.name}</span>
                    <span className="text-midnight-text-secondary text-xs">{user?.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-midnight-text-secondary hover:text-midnight-text-primary"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-20 flex justify-end px-6 pt-4 md:px-8 bg-midnight-bg/95 backdrop-blur supports-[backdrop-filter]:bg-midnight-bg/80">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="border-midnight-border bg-midnight-card text-midnight-text-primary hover:bg-midnight-bg"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </div>
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
