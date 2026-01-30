import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, ToggleLeft, Network, BellRing, FileText, Zap, Menu, Bell, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { api } from '../api';

export function Layout({ children, user, onLogout }) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [activeTenant, setActiveTenant] = useState(null);
    const [loadingTenants, setLoadingTenants] = useState(false);

    // Fetch tenants on mount
    useEffect(() => {
        if (!user) return;
        setLoadingTenants(true);
        Promise.all([
            api.getTenants().catch(() => ({ tenants: [] })),
            api.getActiveTenant().catch(() => ({ tenant: null }))
        ]).then(([tenantsData, activeData]) => {
            setTenants(tenantsData.tenants || []);
            setActiveTenant(activeData.tenant);
        }).finally(() => {
            setLoadingTenants(false);
        });
    }, [user]);

    const handleTenantChange = async (e) => {
        const newTenantId = e.target.value;
        if (!newTenantId) return;

        try {
            await api.setActiveTenant(newTenantId);
            // Refresh to reload data with new tenant context
            window.location.reload();
        } catch (err) {
            console.error("Failed to switch tenant", err);
            alert("Failed to switch tenant");
        }
    };

    const navItems = [
        { label: 'Home Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Clients', path: '/clients', icon: Server },
        { label: 'Switches', path: '/switches', icon: ToggleLeft },
        { label: 'Topology Map', path: '/topology', icon: Network },
        { label: 'Alerts', path: '/alerts', icon: BellRing, alert: true },
        { label: 'Reports', path: '/reports', icon: FileText },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-rich-black text-gray-100 font-sans selection:bg-gold selection:text-black">

            {/* Sidebar Overlay (Mobile Only) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-in-out border-r border-rich-dark bg-rich-gray/95 backdrop-blur-xl md:relative md:translate-x-0 md:w-72 md:flex-shrink-0",
                    sidebarOpen ? "translate-x-0 shadow-2xl shadow-gold/10" : "-translate-x-full"
                )}
            >
                <div className="h-20 flex items-center px-8 border-b border-rich-dark relative overflow-hidden group">
                    {/* Glossy effect */}
                    <div className="absolute inset-0 animate-shimmer"></div>

                    <Zap className="w-6 h-6 text-gold mr-3 animate-pulse-glow z-10" />
                    <span className="text-xl font-bold tracking-wider text-gold-gradient uppercase z-10">Taste of Gold</span>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                        return (
                            <div key={item.path}>
                                <Link
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={clsx(
                                        "relative flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group overflow-hidden",
                                        isActive
                                            ? "text-white bg-gradient-to-r from-gold/20 to-transparent border border-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold shadow-[0_0_10px_#D4AF37]"></div>}

                                    <Icon className={clsx(
                                        "w-5 h-5 mr-4 transition-colors",
                                        isActive ? "text-gold" : "text-gray-500 group-hover:text-gold/80",
                                        item.alert && !isActive && "text-red-400"
                                    )} />
                                    <span className={clsx("font-medium tracking-wide", isActive ? "text-gold-light" : "")}>
                                        {item.label}
                                    </span>
                                </Link>
                            </div>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-rich-dark bg-rich-black/30">
                    <div className="flex items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-gold/20 transition">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-yellow-600 p-[1px]">
                            <div className="w-full h-full rounded-full bg-rich-gray flex items-center justify-center">
                                <span className="font-bold text-xs text-gold">{user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-gray-200">{user?.name || user?.email || 'User'}</div>
                            <div className="text-xs text-gray-500">{user?.role || 'member'}</div>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="text-xs uppercase tracking-widest text-gold/70 hover:text-gold transition"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-rich-black relative">

                {/* Top Header */}
                <header className="h-20 flex items-center justify-between px-8 border-b border-rich-dark bg-rich-black/50 backdrop-blur-md sticky top-0 z-30">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gold hover:bg-white/5 transition mr-4"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Tenant Selector */}
                        {!loadingTenants && tenants.length > 0 && (
                            <div className="relative">
                                <select
                                    className="bg-rich-gray text-xs text-gold border border-gold/20 rounded-lg py-1.5 pl-3 pr-8 appearance-none focus:ring-1 focus:ring-gold focus:outline-none cursor-pointer"
                                    value={activeTenant?.id || ''}
                                    onChange={handleTenantChange}
                                >
                                    {tenants.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-gold/50">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        )}

                        <div className="h-4 w-[1px] bg-rich-dark hidden md:block"></div>

                        {/* Demo Controls */}
                        <div className="flex gap-2">
                            <button onClick={async () => {
                                if (confirm("Seed demo data?")) {
                                    try {
                                        const res = await api.seedDemo();
                                        alert(`Seeded: ${JSON.stringify(res.stats)}`);
                                        window.location.reload();
                                    } catch (e) { alert("Failed to seed: " + e.message); }
                                }
                            }} className="px-3 py-1 bg-gold/10 hover:bg-gold/20 text-gold text-xs rounded border border-gold/20 transition">
                                Seed Demo
                            </button>
                            <button onClick={async () => {
                                if (confirm("Reset demo data?")) {
                                    try {
                                        await api.resetDemo();
                                        alert("Demo data reset.");
                                        window.location.reload();
                                    } catch (e) { alert("Failed to reset: " + e.message); }
                                }
                            }} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs rounded border border-red-500/20 transition">
                                Reset
                            </button>
                        </div>
                        <div className="h-4 w-[1px] bg-rich-dark hidden md:block"></div>
                        <button className="relative p-2.5 rounded-full text-gray-400 hover:text-gold hover:bg-white/5 transition group">
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-rich-black animate-pulse"></span>
                            <Bell className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.5)] transition" />
                        </button>
                        <div className="h-8 w-[1px] bg-rich-dark"></div>
                        <Link to="/settings" className="p-2.5 rounded-full text-gray-400 hover:text-gold hover:bg-white/5 transition">
                            <Settings className="w-5 h-5 hover:rotate-90 transition-transform duration-500" />
                        </Link>
                    </div>
                </header>

                {/* Main View Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-10 relative scroll-smooth">
                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto relative z-10">
                        {children}
                    </div>
                </main>
            </div>

        </div>
    );
}
