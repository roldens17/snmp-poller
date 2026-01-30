import { useEffect, useState } from 'react';
import { api } from '../api';
import { Octagon, AlertTriangle, ArrowRight, BellRing } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export function Alerts() {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        api.getAlerts(true).then(data => setAlerts(data.alerts || []));
    }, []);

    const getSeverityColor = (severity) => {
        if (severity === 'critical') return 'bg-red-500/10 text-red-400 border border-red-500/20';
        if (severity === 'warning') return 'bg-gold/10 text-gold border border-gold/20';
        return 'bg-gray-700/50 text-gray-400 border border-gray-600/50';
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        show: { opacity: 1, x: 0 }
    };

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
                    <span className="text-glow text-white">Alert History</span>
                </h2>
                <div className="flex space-x-3 mt-4 md:mt-0">
                    <select className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-300 focus:ring-1 focus:ring-gold/50 outline-none backdrop-blur-sm hover:bg-black/60 transition cursor-pointer">
                        <option>Severity: All</option>
                        <option>Critical</option>
                        <option>Major</option>
                    </select>
                    <select className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-300 focus:ring-1 focus:ring-gold/50 outline-none backdrop-blur-sm hover:bg-black/60 transition cursor-pointer">
                        <option>Type: All</option>
                        <option>Ups/Downs</option>
                        <option>Errors</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar flex-1 bg-rich-black/30">
                <table className="min-w-full">
                    <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
                        <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5">
                            <th className="p-4 w-16 pl-6">Severity</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Source</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Time</th>
                            <th className="p-4 pr-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <motion.tbody
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="divide-y divide-white/5"
                    >
                        <AnimatePresence>
                            {alerts.map(a => (
                                <motion.tr
                                    variants={itemVariants}
                                    key={a.id}
                                    className="hover:bg-white/5 transition duration-200 cursor-pointer group"
                                >
                                    <td className="p-4 pl-6 whitespace-nowrap">
                                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg", getSeverityColor(a.severity))}>
                                            {a.severity === 'critical' ? <Octagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap text-sm font-bold text-gray-200 group-hover:text-white transition">{a.category}</td>
                                    <td className="p-4 whitespace-nowrap text-sm text-gold/80 font-mono">Device #{a.device_id}</td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={clsx("px-2.5 py-1 inline-flex text-xs leading-5 font-bold uppercase tracking-wide rounded-full border shadow-sm", getSeverityColor(a.severity))}>
                                            {a.severity}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap text-xs text-gray-500 font-mono tracking-wide">
                                        {formatDistanceToNow(new Date(a.triggered_at), { addSuffix: true })}
                                    </td>
                                    <td className="p-4 pr-6 whitespace-nowrap text-sm text-right">
                                        <button className="text-gray-500 hover:text-gold transition duration-200 inline-flex items-center group-hover:bg-gold/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-gold/20">
                                            <span className="text-xs font-semibold mr-2">Investigate</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                        {alerts.length === 0 && (
                            <motion.tr variants={itemVariants}>
                                <td colSpan="6" className="p-12 text-center text-gray-500 italic">No active alerts recorded.</td>
                            </motion.tr>
                        )}
                    </motion.tbody>
                </table>
            </div>
        </motion.div>
    );
}
