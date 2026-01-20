import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, ToggleLeft, Network, BellRing, FileText, Zap, Menu, Bell, Settings } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export function Layout({ children, user, onLogout }) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navItems = [
        { label: 'Home Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Devices', path: '/devices', icon: Server },
        { label: 'Switches', path: '/switches', icon: ToggleLeft },
        { label: 'Topology Map', path: '/topology', icon: Network },
        { label: 'Alerts', path: '/alerts', icon: BellRing, alert: true },
        { label: 'Reports', path: '/reports', icon: FileText },
    ];

    const getPageTitle = (pathname) => {
        if (pathname === '/') return 'Home Dashboard';
        if (pathname.startsWith('/devices')) return 'Devices';
        if (pathname.startsWith('/switches')) return 'Switches';
        if (pathname.startsWith('/topology')) return 'Topology Map';
        if (pathname.startsWith('/alerts')) return 'Alerts';
        if (pathname.startsWith('/reports')) return 'Reports';
        return 'Dashboard';
    };

    return (
        <div className="flex h-screen overflow-hidden bg-rich-black text-gray-100 font-sans selection:bg-gold selection:text-black">

            {/* Sidebar Overlay (Mobile Only) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-in-out border-r border-rich-dark bg-rich-gray/95 backdrop-blur-xl md:relative md:translate-x-0 md:w-72 md:flex-shrink-0",
                sidebarOpen ? "translate-x-0 shadow-2xl shadow-gold/10" : "-translate-x-full"
            )}>
                <div className="h-20 flex items-center px-8 border-b border-rich-dark relative overflow-hidden group">
                    {/* Glossy effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/5 to-gold/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                    <Zap className="w-6 h-6 text-gold mr-3 animate-pulse" />
                    <span className="text-xl font-bold tracking-wider text-gold-gradient uppercase">Taste of Gold</span>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                        return (
                            <Link
                                key={item.path}
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
                        <h1 className="text-2xl font-bold text-white tracking-tight">{getPageTitle(location.pathname)}</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2.5 rounded-full text-gray-400 hover:text-gold hover:bg-white/5 transition group">
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-rich-black animate-pulse"></span>
                            <Bell className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.5)] transition" />
                        </button>
                        <div className="h-8 w-[1px] bg-rich-dark"></div>
                        <button className="p-2.5 rounded-full text-gray-400 hover:text-gold hover:bg-white/5 transition">
                            <Settings className="w-5 h-5 hover:rotate-90 transition-transform duration-500" />
                        </button>
                    </div>
                </header>

                {/* Main View Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-10 relative scroll-smooth">
                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto relative z-10 fade-in">
                        {children}
                    </div>
                </main>
            </div>

        </div>
    );
}
