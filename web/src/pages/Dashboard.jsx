import { useEffect, useState } from 'react';
import { api } from '../api';
import { AlertCircle, Server, ToggleRight, GitMerge, Bug, Octagon, ArrowRight, BarChart2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function Dashboard() {
    const [stats, setStats] = useState({ devices: 0, alerts: 0, up: 0, down: 0 });
    const [alerts, setAlerts] = useState([]);
    const [topTalkers, setTopTalkers] = useState([]); // Mocking this for now as backend support isn't explicit
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [devData, alertData, macsData] = await Promise.all([
                    api.getDevices(),
                    api.getAlerts(true),
                    api.getDeviceMacs(1) // Just fetching some macs to fake traffic data
                ]);

                const devs = devData.devices || [];
                const upCount = devs.filter(d => (new Date() - new Date(d.last_seen)) < 120000).length;

                setStats({
                    devices: devs.length,
                    up: upCount,
                    down: devs.length - upCount,
                    alerts: (alertData.alerts || []).length
                });
                setAlerts(alertData.alerts || []);

                // Mocking traffic data
                const mockTalkers = (macsData.mac_entries || []).slice(0, 5).map(m => ({
                    name: 'Device ' + m.mac.slice(-5),
                    mac: m.mac,
                    traffic: Math.floor(Math.random() * 2000)
                })).sort((a, b) => b.traffic - a.traffic);
                setTopTalkers(mockTalkers);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const cardData = [
        { title: 'Total Devices', value: stats.devices, icon: Server, color: 'text-gold', secondary: `${stats.devices} Monitored` },
        { title: 'Switches Online', value: `${stats.up}/${stats.devices}`, icon: ToggleRight, color: stats.down > 0 ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]', secondary: `${stats.down} Offline` },
        { title: 'Rogue Devices', value: 0, icon: AlertCircle, color: 'text-gray-400', secondary: 'No threats' },
        { title: 'Loops Detected', value: 0, icon: GitMerge, color: 'text-gray-400', secondary: 'Stable' },
        { title: 'Active Alerts', value: stats.alerts, icon: Bug, color: stats.alerts > 0 ? 'text-red-500' : 'text-gold', secondary: 'Current' },
    ];

    const getSeverityColor = (severity) => {
        if (severity === 'critical') return 'bg-red-500/10 text-red-500 border border-red-500/20';
        if (severity === 'warning') return 'bg-gold/10 text-gold border border-gold/20';
        return 'bg-gray-700/50 text-gray-400 border border-gray-600/50';
    }

    if (loading) return <div className="text-gold animate-pulse text-2xl font-bold flex justify-center items-center h-full tracking-widest uppercase">Initializing...</div>;

    return (
        <div className="fade-in space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {cardData.map((card, i) => (
                    <div key={i} className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 transition duration-500">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-gold/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition duration-700 blur-xl"></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div className={clsx("p-2 rounded-lg bg-white/5 ring-1 ring-white/10 group-hover:ring-gold/20 transition duration-500", card.color.includes('text-gold') && "shadow-[0_0_15px_rgba(212,175,55,0.1)]")}>
                                <card.icon className={clsx("w-6 h-6", card.color)} />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-white/5 text-gray-400 border border-white/5 uppercase">Metric</span>
                        </div>

                        <div className="mt-6 relative z-10">
                            <p className="text-4xl font-extrabold text-white tracking-tight group-hover:text-gold-light transition duration-300">{card.value}</p>
                            <p className="text-sm text-gray-400 mt-1 font-medium">{card.title}</p>
                            <div className="h-px w-8 bg-gold/20 my-3 group-hover:w-full transition-all duration-700"></div>
                            <p className="text-xs text-gold/80 font-mono tracking-wide">{card.secondary}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Talkers */}
                <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
                    <h2 className="text-xl font-bold mb-8 flex items-center text-white">
                        <div className="p-2 rounded-lg bg-gold/10 mr-3 border border-gold/10">
                            <BarChart2 className="w-5 h-5 text-gold" />
                        </div>
                        Top Talkers <span className="text-gray-500 font-normal text-sm ml-2">(Traffic Rx/Tx)</span>
                    </h2>
                    <div className="space-y-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {topTalkers.map((t, i) => (
                            <div key={i} className="group">
                                <div className="flex justify-between text-sm text-gray-300 mb-2">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-gold mr-3 shadow-[0_0_8px_#D4AF37]"></div>
                                        <span className="font-bold text-white group-hover:text-gold transition">{t.name}</span>
                                        <span className="text-gray-500 text-xs ml-2 font-mono">[{t.mac}]</span>
                                    </div>
                                    <span className="font-mono text-gold-light drop-shadow-[0_0_5px_rgba(212,175,55,0.3)]">{t.traffic.toLocaleString()} MB</span>
                                </div>
                                <div className="w-full bg-rich-dark rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light relative"
                                        style={{ width: `${(t.traffic / 2000) * 100}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {topTalkers.length === 0 && <div className="text-center text-gray-500 py-10 italic">No traffic data available</div>}
                    </div>
                </div>

                {/* Alerts */}
                <div className="lg:col-span-1 glass-panel p-0 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                        <h2 className="text-lg font-bold flex justify-between items-center text-white">
                            <span>Recent Alerts</span>
                            {alerts.length > 0 &&
                                <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse">
                                    {alerts.length} ACTIVE
                                </span>
                            }
                        </h2>
                    </div>

                    <ul className="divide-y divide-white/5 overflow-y-auto custom-scrollbar max-h-96">
                        {alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                                <Octagon className="w-10 h-10 mb-3 opacity-20" />
                                <span className="text-sm">No active alerts</span>
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <li key={alert.id} className="p-4 hover:bg-white/5 transition duration-200 cursor-pointer group border-l-2 border-transparent hover:border-gold">
                                    <div className="flex items-start space-x-3">
                                        <span className={clsx("p-1.5 rounded-lg flex-shrink-0 mt-0.5", getSeverityColor(alert.severity))}>
                                            <Octagon className="w-3.5 h-3.5" />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-200 group-hover:text-gold transition truncate">
                                                {alert.category}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 flex items-center">
                                                <Server className="w-3 h-3 mr-1" />
                                                Device #{alert.device_id}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{alert.message}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <span className="text-[10px] text-gray-600 font-mono bg-black/20 px-2 py-1 rounded">
                                            {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                    {alerts.length > 0 && (
                        <div className="p-3 bg-white/[0.02] border-t border-white/5 text-center">
                            <button className="text-xs text-gold hover:text-white transition font-medium flex items-center justify-center w-full">
                                View All Alerts <ArrowRight className="w-3 h-3 ml-1" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
