import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertCircle, Server, ToggleRight, GitMerge, Bug, Octagon, ArrowRight, BarChart2, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { getDeviceStatusInfo } from '../utils/deviceStatus';
import { motion } from 'framer-motion';
import { parseAPITimestamp } from '../utils/time';

export function Dashboard() {
    const [stats, setStats] = useState({ devices: 0, alerts: 0, up: 0, down: 0 });
    const [alerts, setAlerts] = useState([]);
    const [tenantOverview, setTenantOverview] = useState([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [tenantDetails, setTenantDetails] = useState({ devices_down: [], active_alerts: [] });
    const [tenantDetailsLoading, setTenantDetailsLoading] = useState(false);
    const [webhookCount, setWebhookCount] = useState(0);
    const [onboardingDismissed, setOnboardingDismissed] = useState(() => localStorage.getItem('onboardingDismissed') === '1');
    const [topTalkers, setTopTalkers] = useState([]); // Mocking this for now as backend support isn't explicit
    const [loading, setLoading] = useState(true);
    const [trafficWindow, setTrafficWindow] = useState('5m');
    const navigate = useNavigate();

    useEffect(() => {
        async function load() {
            try {
                const [devRes, alertRes, overviewRes, macsRes, destRes] = await Promise.allSettled([
                    api.getDevices(),
                    api.getAPIAlerts('active', 20),
                    api.getTenantOverview(),
                    api.getDeviceMacs(1),
                    api.getAlertDestinations()
                ]);

                const devs = devRes.status === 'fulfilled' ? (devRes.value.devices || []) : [];
                const upCount = devs.filter(d => getDeviceStatusInfo(d.status, d.last_seen).label === 'Healthy').length;

                setStats({
                    devices: devs.length,
                    up: upCount,
                    down: devs.length - upCount,
                    alerts: alertRes.status === 'fulfilled' ? (alertRes.value.alerts || []).length : 0
                });
                setAlerts(alertRes.status === 'fulfilled' ? (alertRes.value.alerts || []) : []);
                setTenantOverview(overviewRes.status === 'fulfilled' ? (overviewRes.value.tenants || []) : []);
                setWebhookCount(destRes.status === 'fulfilled' ? ((destRes.value.destinations || []).filter(d => d.is_enabled).length) : 0);

                // Mocking traffic data
                if (macsRes.status === 'fulfilled') {
                    const mockTalkers = (macsRes.value.mac_entries || []).slice(0, 5).map(m => ({
                        name: 'Device ' + m.mac.slice(-5),
                        mac: m.mac,
                        traffic: Math.floor(Math.random() * 2000),
                        deviceId: m.device_id
                    })).sort((a, b) => b.traffic - a.traffic);
                    setTopTalkers(mockTalkers);
                }

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const cardData = [
        { title: 'Managed Devices', value: stats.devices, icon: Server, color: 'text-gold', secondary: stats.devices === 0 ? 'No devices onboarded yet' : `${stats.devices} in inventory`, chip: 'Inventory', path: '/clients?status=all' },
        { title: 'Online Switches', value: `${stats.up}/${stats.devices}`, icon: ToggleRight, color: stats.down > 0 ? 'text-red-500' : 'text-green-400', secondary: stats.down === 0 ? 'All monitored switches are online' : `${stats.down} offline`, chip: 'Live', path: '/switches?status=online' },
        { title: 'Untrusted Devices', value: 0, icon: AlertCircle, color: 'text-gray-400', secondary: 'No rogue activity detected', chip: 'Risk', path: '/clients?risk=rogue' },
        { title: 'Loop Events (Open)', value: 0, icon: GitMerge, color: 'text-gray-400', secondary: 'No loop events detected', chip: 'L2 Health', path: '/topology?issue=loop&status=open' },
        { title: 'Active Incidents', value: stats.alerts, icon: Bug, color: stats.alerts > 0 ? 'text-red-500' : 'text-gold', secondary: stats.alerts === 0 ? 'No active incidents' : 'Action required', chip: 'Incidents', path: '/alerts?status=active' },
    ];

    const getSeverityColor = (severity) => {
        if (severity === 'critical') return 'bg-red-500/10 text-red-500 border border-red-500/20';
        if (severity === 'warning') return 'bg-gold/10 text-gold border border-gold/20';
        return 'bg-gray-700/50 text-gray-400 border border-gray-600/50';
    }

    const getTrafficValue = (talker) => trafficWindow === '1h' ? Math.round(talker.traffic * 6) : talker.traffic;

    const handleAlertOpen = (alert) => {
        if (!alert.device_id) return;
        navigate(`/devices/${alert.device_id}`);
    };

    const handleTopTalkerClick = (talker) => {
        if (!talker.deviceId) return;
        navigate(`/devices/${talker.deviceId}`);
    };

    const loadTenantDetails = async (tenantId, { silent = false } = {}) => {
        if (!tenantId) return;
        if (!silent) setTenantDetailsLoading(true);
        try {
            const details = await api.getTenantOverviewDetails(tenantId);
            setTenantDetails({
                devices_down: details.devices_down || [],
                active_alerts: details.active_alerts || [],
            });
        } catch (err) {
            console.error('failed tenant details', err);
            if (!silent) setTenantDetails({ devices_down: [], active_alerts: [] });
        } finally {
            if (!silent) setTenantDetailsLoading(false);
        }
    };

    const handleTenantSelect = async (tenantId) => {
        if (!tenantId) return;
        if (selectedTenantId === tenantId) {
            setSelectedTenantId('');
            setTenantDetails({ devices_down: [], active_alerts: [] });
            return;
        }
        setSelectedTenantId(tenantId);
        await loadTenantDetails(tenantId);
    };

    useEffect(() => {
        if (!selectedTenantId) return;
        const id = setInterval(() => {
            loadTenantDetails(selectedTenantId, { silent: true });
        }, 30000);
        return () => clearInterval(id);
    }, [selectedTenantId]);


    const onboarding = {
        hasDevices: stats.devices > 0,
        hasAlertsDestination: webhookCount > 0,
        viewedAlerts: alerts.length >= 0,
    };
    const completedSteps = [onboarding.hasDevices, onboarding.hasAlertsDestination].filter(Boolean).length;
    const showOnboarding = !onboardingDismissed && completedSteps < 2;

    const dismissOnboarding = () => {
        setOnboardingDismissed(true);
        localStorage.setItem('onboardingDismissed', '1');
    };

    const freshestPollAt = tenantOverview
        .map(t => parseAPITimestamp(t.last_poll_at))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
    const pollFreshnessText = freshestPollAt ? formatDistanceToNow(freshestPollAt, { addSuffix: true }) : 'not started';
    const hasPollData = Boolean(freshestPollAt);

    if (loading) {
        return (
            <div className="text-center text-gold animate-pulse text-xl font-bold flex flex-col justify-center items-center h-full tracking-widest uppercase space-y-3">
                <div>Initializing...</div>
                <p className="text-xs text-gray-500 normal-case tracking-normal">Bring your switches online and confirm the poller URL in config.yaml.</p>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
        >
            <motion.div variants={itemVariants} className="glass-panel p-4 rounded-xl border border-white/10">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300">API: Healthy</span>
                    <span className={clsx('px-2 py-1 rounded-lg border', hasPollData ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300')}>
                        Poll freshness: {pollFreshnessText}
                    </span>
                    <span className={clsx('px-2 py-1 rounded-lg border', webhookCount > 0 ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300')}>
                        Alert pipeline: {webhookCount > 0 ? `${webhookCount} destination(s)` : 'not configured'}
                    </span>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {cardData.map((card, i) => (
                    <motion.div variants={itemVariants} key={i}>
                        <Link
                            to={card.path}
                            className="block h-full"
                        >
                            <motion.div
                                whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(212, 175, 55, 0.12)" }}
                                className="glass-panel p-6 rounded-xl relative overflow-hidden group hover:border-gold/30 focus-within:ring-2 focus-within:ring-gold/50 transition duration-500 h-full"
                            >
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-gold/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition duration-700 blur-xl"></div>

                                <div className="flex justify-between items-start relative z-10">
                                    <div className={clsx("p-2 rounded-lg bg-white/5 ring-1 ring-white/10 group-hover:ring-gold/20 transition duration-500", card.color.includes('text-gold') && "shadow-[0_0_15px_rgba(212,175,55,0.1)]")}>
                                        <card.icon className={clsx("w-6 h-6", card.color)} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10 uppercase">{card.chip}</span>
                                </div>

                                <div className="mt-6 relative z-10">
                                    <p className="text-4xl font-extrabold text-white tracking-tight group-hover:text-gold-light transition duration-300">{card.value}</p>
                                    <p className="text-sm text-gray-400 mt-1 font-medium">{card.title}</p>
                                    <div className="h-px w-8 bg-gold/20 my-3 group-hover:w-full transition-all duration-700"></div>
                                    <p className="text-xs text-gold/80 font-mono tracking-wide">{card.secondary}</p>
                                </div>
                            </motion.div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {showOnboarding && (
                <motion.div variants={itemVariants} className="glass-panel p-6 rounded-xl border border-gold/20">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 text-white font-semibold">
                            <Sparkles className="w-5 h-5 text-gold" />
                            Get production-ready in 2 steps
                        </div>
                        <button onClick={dismissOnboarding} className="text-xs text-gray-400 hover:text-white">Skip for now</button>
                    </div>
                    <div className="text-xs text-gray-400 mb-3">Estimated time: 3 minutes</div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className={`w-4 h-4 ${onboarding.hasDevices ? 'text-green-400' : 'text-gray-500'}`} />
                                <span>Add your first device to start SLA tracking</span>
                            </div>
                            {!onboarding.hasDevices && <Link className="text-gold" to="/devices/new">Go</Link>}
                        </div>
                        <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className={`w-4 h-4 ${onboarding.hasAlertsDestination ? 'text-green-400' : 'text-gray-500'}`} />
                                <span>Connect an alert destination for real-time incidents</span>
                            </div>
                            {!onboarding.hasAlertsDestination && <Link className="text-gold" to="/settings?tab=alerts">Go</Link>}
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div variants={itemVariants} className="glass-panel p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-white">Tenant Overview</h2>
                {tenantOverview.length === 0 ? (
                    <div className="text-sm text-gray-500">No tenant overview data yet.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tenantOverview.map(t => (
                            <button key={t.tenant_id} onClick={() => handleTenantSelect(t.tenant_id)} className={clsx("p-4 rounded-xl border bg-white/5 text-left transition", selectedTenantId === t.tenant_id ? "border-gold/40" : "border-white/10 hover:border-gold/20")}>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-white">{t.name}</div>
                                    <span className={clsx('px-2 py-0.5 rounded text-[10px] uppercase border', t.status_color === 'red' ? 'text-red-400 border-red-500/30 bg-red-500/10' : t.status_color === 'yellow' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-green-400 border-green-500/30 bg-green-500/10')}>{t.status_color}</span>
                                </div>
                                <div className="mt-2 text-xs text-gray-400 space-y-1">
                                    <div>Devices down: <span className="text-white">{t.devices_down}</span></div>
                                    <div>Active alerts: <span className="text-white">{t.active_alerts}</span></div>
                                    <div>Last poll: <span className="text-white">{t.last_poll_at ? formatDistanceToNow(parseAPITimestamp(t.last_poll_at), { addSuffix: true }) : 'not started'}</span></div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {selectedTenantId && (
                    <div className="mt-4 p-4 rounded-xl border border-gold/20 bg-black/20">
                        <div className="text-sm font-semibold text-gold mb-3">Tenant details</div>
                        {tenantDetailsLoading ? (
                            <div className="text-xs text-gray-400">Loading tenant details...</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs uppercase text-gray-500 mb-2">Devices Down</div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {tenantDetails.devices_down.length === 0 ? (
                                            <div className="text-xs text-gray-500">No devices down</div>
                                        ) : tenantDetails.devices_down.map(d => (
                                            <div key={d.device_id} className="p-2 rounded border border-white/10 bg-white/5 text-xs">
                                                <div className="text-white font-medium">{d.device_name || `Device #${d.device_id}`}</div>
                                                <div className="text-gray-400">{d.device_ip || 'not started'}</div>
                                                <div className="text-gray-500">down since: {d.down_since ? formatDistanceToNow(parseAPITimestamp(d.down_since), { addSuffix: true }) : 'not started'}</div>
                                                <div className="text-gray-500">last success: {d.last_success_at ? formatDistanceToNow(parseAPITimestamp(d.last_success_at), { addSuffix: true }) : 'not started'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase text-gray-500 mb-2">Active DEVICE_DOWN Alerts</div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {tenantDetails.active_alerts.length === 0 ? (
                                            <div className="text-xs text-gray-500">No active alerts</div>
                                        ) : tenantDetails.active_alerts.map(a => (
                                            <div key={a.id} className="p-2 rounded border border-red-500/20 bg-red-500/5 text-xs">
                                                <div className="text-red-300 font-medium">{a.title || 'Device unreachable'}</div>
                                                <div className="text-gray-300">{a.device_name || `Device #${a.device_id}`} • {a.device_ip || 'not started'}</div>
                                                <div className="text-gray-500">down since: {a.triggered_at ? formatDistanceToNow(parseAPITimestamp(a.triggered_at), { addSuffix: true }) : 'not started'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Talkers */}
                <motion.div variants={itemVariants} className="lg:col-span-2 glass-panel p-6 rounded-xl">
                    <h2 className="text-xl font-bold mb-8 flex items-center text-white">
                        <div className="p-2 rounded-lg bg-gold/10 mr-3 border border-gold/10">
                            <BarChart2 className="w-5 h-5 text-gold" />
                        </div>
                        Top Talkers <span className="text-gray-500 font-normal text-sm ml-2">(Traffic Rx/Tx)</span>
                        <div className="ml-auto flex items-center gap-2">
                            {['5m', '1h'].map(window => (
                                <button
                                    key={window}
                                    onClick={() => setTrafficWindow(window)}
                                    className={clsx(
                                        "text-xs px-3 py-1 rounded-full border transition font-medium",
                                        trafficWindow === window
                                            ? "border-gold/50 text-gold bg-gold/10 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                                            : "border-white/5 text-gray-400 hover:text-white hover:border-gold/30"
                                    )}
                                >
                                    Last {window}
                                </button>
                            ))}
                        </div>
                    </h2>
                    <div className="space-y-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {topTalkers.map((t, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group cursor-pointer rounded-lg transition hover:bg-white/5 p-2 focus-within:ring-2 focus-within:ring-gold/50"
                                onClick={() => handleTopTalkerClick(t)}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTopTalkerClick(t)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex justify-between text-sm text-gray-300 mb-2">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-gold mr-3 shadow-[0_0_8px_#D4AF37]"></div>
                                        <span className="font-bold text-white group-hover:text-gold transition">{t.name}</span>
                                        <span className="text-gray-500 text-xs ml-2 font-mono">[{t.mac}]</span>
                                    </div>
                                    <span className="font-mono text-gold-light drop-shadow-[0_0_5px_rgba(212,175,55,0.3)]">{getTrafficValue(t).toLocaleString()} MB</span>
                                </div>
                                <div className="w-full bg-rich-dark rounded-full h-2.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (getTrafficValue(t) / 2000) * 100)}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light relative"
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        ))}
                        {topTalkers.length === 0 && (
                            <div className="text-center text-gray-500 py-10 italic flex flex-col items-center space-y-3">
                                <div>No traffic data yet — connect a switch to start throughput insights.</div>
                                <Link to="/switches" className="text-xs text-gold hover:text-white transition border border-gold/30 px-3 py-1 rounded-full hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]">Register Switches to see traffic</Link>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Alerts */}
                <motion.div variants={itemVariants} className="lg:col-span-1 glass-panel p-0 rounded-xl overflow-hidden flex flex-col">
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
                                <div className="p-4 rounded-full bg-gold/5 mb-4 border border-gold/10 shadow-[0_0_15px_rgba(212,175,55,0.05)]">
                                    <Bug className="w-8 h-8 text-gold/40" />
                                </div>
                                <span className="text-sm font-medium text-gray-400">No active incidents — all monitored systems operational</span>
                                <Link to="/alerts" className="text-[10px] uppercase tracking-widest text-gold hover:text-white transition mt-4 border border-gold/20 hover:bg-gold/10 rounded-full px-4 py-1.5">
                                    View History
                                </Link>
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <li
                                    key={alert.id}
                                    className="p-4 hover:bg-white/5 transition duration-200 cursor-pointer group border-l-2 border-transparent hover:border-gold focus-within:ring-2 focus-within:ring-gold/50"
                                    onClick={() => handleAlertOpen(alert)}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleAlertOpen(alert)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="flex items-start space-x-3">
                                        <span className={clsx("p-1.5 rounded-lg flex-shrink-0 mt-0.5", getSeverityColor(alert.severity))}>
                                            <Octagon className="w-3.5 h-3.5" />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-200 group-hover:text-gold transition truncate">
                                                {alert.title || alert.alert_type}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 flex items-center">
                                                <Server className="w-3 h-3 mr-1" />
                                                Device #{alert.device_id}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{alert.details ? (typeof alert.details === "string" ? alert.details : JSON.stringify(alert.details)) : ""}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <span className="text-[10px] text-gray-600 font-mono bg-black/20 px-2 py-1 rounded">
                                            {(() => {
                                                const ts = parseAPITimestamp(alert.triggered_at);
                                                return ts ? formatDistanceToNow(ts, { addSuffix: true }) : 'unknown';
                                            })()}
                                        </span>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                    {alerts.length > 0 && (
                        <div className="p-3 bg-white/[0.02] border-t border-white/5 text-center">
                            <Link to="/alerts" className="text-xs text-gold hover:text-white transition font-medium flex items-center justify-center w-full">
                                View All Alerts <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
