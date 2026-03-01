import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Octagon, AlertTriangle, ArrowRight, BellRing, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { parseAPITriggeredstamp } from '../utils/time';

export function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);
    const navigate = useNavigate();

    const loadAlerts = async () => {
        setError('');
        if (!lastUpdated) setLoading(true);
        try {
            const data = await api.getAlerts(true);
            setAlerts(data.alerts || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to load alerts', err);
            setError('Unable to load incident feed right now.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();
        intervalRef.current = setInterval(loadAlerts, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getSeverityColor = (severity) => {
        if (severity === 'critical') return 'bg-red-500/10 text-red-400 border border-red-500/20';
        if (severity === 'warning') return 'bg-gold/10 text-gold border border-gold/20';
        return 'bg-gray-700/50 text-gray-400 border border-gray-600/50';
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel-premium rounded-2xl shadow-xl border border-white/5 h-full flex flex-col"
        >
            <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gold/10 border border-gold/10">
                        <BellRing className="w-5 h-5 text-gold" />
                    </div>
                    <span className="text-glow text-white">Incident Feed</span>
                </h2>
                <div className="flex flex-wrap gap-3 mt-4 md:mt-0 items-center">
                    <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-300">Pipeline: Active</span>
                    {lastUpdated && (
                        <span className="text-[11px] uppercase tracking-wider text-gray-500">
                            Feed updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                        </span>
                    )}
                    <button
                        onClick={loadAlerts}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold border border-white/10 transition"
                        title="Refresh incident feed"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <select className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-300 focus:ring-1 focus:ring-gold/50 outline-none backdrop-blur-sm hover:bg-black/60 transition cursor-pointer">
                        <option>Severity: all</option>
                        <option>Critical</option>
                        <option>Warning</option>
                        <option>Info</option>
                    </select>
                    <select className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-300 focus:ring-1 focus:ring-gold/50 outline-none backdrop-blur-sm hover:bg-black/60 transition cursor-pointer">
                        <option>Alert Type: all</option>
                        <option>Device availability</option>
                        <option>Topology</option>
                        <option>Performance</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar flex-1 bg-rich-black/30">
                <div className="min-w-[900px]">
                    <div className="bg-white/5 sticky top-0 backdrop-blur-md z-10 text-left text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 grid grid-cols-12">
                        <div className="p-4 pl-6 col-span-2">Severity</div>
                        <div className="p-4 col-span-2">Alert Type</div>
                        <div className="p-4 col-span-2">Target</div>
                        <div className="p-4 col-span-2">Severity</div>
                        <div className="p-4 col-span-2">Triggered</div>
                        <div className="p-4 pr-6 col-span-2 text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-white/5">
                        {error && (
                            <div className="p-6 text-red-400 text-sm bg-red-500/10 border border-red-500/20">
                                {error} (click Refresh to retry)
                            </div>
                        )}
                        {loading && !error && (
                            <div className="p-6 text-center text-gray-400 text-sm">Loading alerts...</div>
                        )}
                        {!loading && !error && alerts.map((a, idx) => (
                            <div
                                key={a.id}
                                className={clsx(
                                    "grid grid-cols-12 items-center transition duration-200 cursor-pointer group",
                                    idx % 2 === 0 ? "bg-white/[0.02]" : "bg-white/0",
                                    "hover:bg-white/5"
                                )}
                                onClick={() => a.device_id && navigate(`/devices/${a.device_id}`)}
                            >
                                <div className="p-4 pl-6 col-span-2">
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg", getSeverityColor(a.severity))}>
                                        {a.severity === 'critical' ? <Octagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    </div>
                                </div>
                                <div className="p-4 col-span-2 text-sm font-bold text-gray-200 group-hover:text-white transition">{a.title || a.alert_type || a.category}</div>
                                <div className="p-4 col-span-2 text-sm text-gold/80 font-mono">Device #{a.device_id}</div>
                                <div className="p-4 col-span-2">
                                    <span className={clsx("px-2.5 py-1 inline-flex text-xs leading-5 font-bold uppercase tracking-wide rounded-full border shadow-sm", getSeverityColor(a.severity))}>
                                        {a.severity}
                                    </span>
                                </div>
                                <div className="p-4 col-span-2 text-xs text-gray-500 font-mono tracking-wide">
                                    {(() => {
                                        const ts = parseAPITriggeredstamp(a.triggered_at);
                                        return ts ? formatDistanceToNow(ts, { addSuffix: true }) : 'unknown';
                                    })()}
                                </div>
                                <div className="p-4 pr-6 col-span-2 text-sm text-right">
                                    <button
                                        className="text-gray-500 hover:text-gold transition duration-200 inline-flex items-center group-hover:bg-gold/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-gold/20 disabled:opacity-50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (a.device_id) {
                                                navigate(`/devices/${a.device_id}`);
                                            }
                                        }}
                                        disabled={!a.device_id}
                                    >
                                        <span className="text-xs font-semibold mr-2">Investigate</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!loading && !error && alerts.length === 0 && (
                            <div className="p-12 text-center text-gray-500 italic">No active incidents. Your network is stable right now.</div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
