import { Link, useLocation } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, FileText, LogOut, Menu, Network, RefreshCw, Server, Settings, ShieldCheck, Webhook, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { api } from '../api';
import { useToast } from './ToastProvider';
import { useConfirm } from './ConfirmProvider';

export function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ state: 'checking', error: '', updatedAt: null });
  const [alertCount, setAlertCount] = useState(0);
  const toast = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    if (!user) return;
    setLoadingTenants(true);
    Promise.all([
      api.getTenants().catch(() => ({ tenants: [] })),
      api.getActiveTenant().catch(() => ({ tenant: null })),
    ])
      .then(([tenantsData, activeData]) => {
        setTenants(tenantsData.tenants || []);
        setActiveTenant(activeData.tenant);
      })
      .finally(() => setLoadingTenants(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const data = await api.getSystemStatus();
        if (cancelled) return;
        setSystemStatus({
          state: data.status || 'ok',
          error: '',
          updatedAt: data.time ? new Date(data.time) : new Date(),
        });
      } catch (err) {
        if (cancelled) return;
        setSystemStatus({ state: 'degraded', error: err?.message || 'Unable to reach API', updatedAt: new Date() });
      }
    };

    const loadAlerts = async () => {
      try {
        const data = await api.getAlerts(true);
        if (!cancelled) setAlertCount((data.alerts || []).length);
      } catch {
        if (!cancelled) setAlertCount(0);
      }
    };

    checkStatus();
    loadAlerts();
    const statusId = setInterval(checkStatus, 30000);
    const alertId = setInterval(loadAlerts, 30000);

    return () => {
      cancelled = true;
      clearInterval(statusId);
      clearInterval(alertId);
    };
  }, [user]);

  const refreshSystemStatus = () => {
    setSystemStatus((prev) => ({ ...prev, state: 'checking' }));
    api.getSystemStatus()
      .then((data) => setSystemStatus({ state: data.status || 'ok', error: '', updatedAt: data.time ? new Date(data.time) : new Date() }))
      .catch((err) => setSystemStatus({ state: 'degraded', error: err?.message || 'Unable to reach API', updatedAt: new Date() }));
  };

  const handleTenantChange = async (e) => {
    const newTenantId = e.target.value;
    if (!newTenantId) return;
    try {
      await api.setActiveTenant(newTenantId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch tenant', err);
      toast.error('Failed to switch tenant');
    }
  };

  const handleSeedDemo = async () => {
    if (!await confirm('Seed demo data?')) return;
    try {
      await api.seedDemo();
      window.location.reload();
    } catch (err) {
      toast.error(`Failed to seed: ${err.message}`);
    }
  };

  const handleResetDemo = async () => {
    if (!await confirm('Reset demo data?')) return;
    try {
      await api.resetDemo();
      window.location.reload();
    } catch (err) {
      toast.error(`Failed to reset: ${err.message}`);
    }
  };

  const primaryNav = [
    { label: 'Dashboard', path: '/', icon: Activity },
    { label: 'Devices', path: '/switches', icon: Server },
    { label: 'Incidents', path: '/alerts', icon: AlertTriangle },
    { label: 'Webhooks', path: '/settings?tab=alerts', icon: Webhook },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const secondaryNav = [
    { label: 'Clients', path: '/clients', icon: ShieldCheck },
    { label: 'Topology', path: '/topology', icon: Network },
  ];

  const NavLinks = ({ mobile = false }) => (
    <>
      {primaryNav.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path.split('?')[0]));
        return (
          <Link
            key={item.label}
            to={item.path}
            onClick={() => mobile && setSidebarOpen(false)}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="px-3 pb-2 text-[10px] uppercase tracking-wide text-slate-500">More</p>
        {secondaryNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => mobile && setSidebarOpen(false)}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-950 transition-transform md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-500" />
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-white">NetMonitor</span>
              <span className="text-xs text-slate-400">{activeTenant?.name || 'Default Tenant'}</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLinks mobile />
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="rounded-lg bg-slate-900/80 p-3">
            <div className="text-sm font-medium text-white">{user?.email || 'admin@example.com'}</div>
            <div className="text-xs text-slate-400">{user?.role || 'owner'}</div>
            {onLogout && (
              <button onClick={onLogout} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white">
                <LogOut className="h-3 w-3" /> Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-200 md:hidden">
                <Menu className="h-5 w-5" />
              </button>
              {!loadingTenants && tenants.length > 0 && (
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                  value={activeTenant?.id || ''}
                  onChange={handleTenantChange}
                >
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('rounded-lg border px-2.5 py-1 text-xs', systemStatus.state === 'ok' ? 'border-green-300 bg-green-100 text-green-700' : 'border-amber-300 bg-amber-100 text-amber-700')}>
                API {systemStatus.state === 'ok' ? 'healthy' : systemStatus.state === 'checking' ? 'checking' : 'degraded'}
              </span>
              <button onClick={refreshSystemStatus} className="rounded-md p-2 text-slate-500 hover:bg-slate-200" title="Refresh status">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button onClick={handleSeedDemo} className="rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-200">Seed Demo</button>
              <button onClick={handleResetDemo} className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-200">Reset</button>
              <Link to="/alerts" className="relative rounded-md p-2 text-slate-600 hover:bg-slate-200" title="Alerts">
                {alertCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold text-white">{alertCount > 99 ? '99+' : alertCount}</span>}
                <Bell className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
