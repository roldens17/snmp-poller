import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Search, Filter, MoreHorizontal, Plus, Smartphone, Router } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { parseAPITimestamp } from '../utils/time';
import clsx from 'clsx';
import { StatusMessage } from '../components/StatusMessage';
import { motion, AnimatePresence } from 'framer-motion';

export function Clients() {
    const [macs, setMacs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadMacs = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getMacs();
            setMacs(data.mac_entries || []);
        } catch (e) {
            console.error('Failed to load devices', e);
            setError('Unable to load devices right now. Check the API URL and try again.');
            setMacs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMacs();
    }, []);

    const filtered = macs.filter(m =>
        m.mac.toLowerCase().includes(search.toLowerCase())
    );

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
            className="flex flex-col h-full space-y-6"
        >
            <div className="flex flex-col md:flex-row justify-between items-end mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
                            <Smartphone className="w-6 h-6 text-gold" />
                        </div>
                        <span className="text-glow">Client Inventory</span>
                    </h1>
                    <p className="text-gray-400 mt-2 ml-1">Track endpoints, MAC addresses, and network presence.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <div className="relative flex-1 md:flex-initial group">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500 group-focus-within:text-gold transition" />
                        <input
                            type="text"
                            placeholder="Search MAC Address..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full md:w-64 pl-10 p-2.5 rounded-xl bg-rich-gray/50 border border-white/5 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 text-sm outline-none text-white placeholder-gray-500 transition-all shadow-inner"
                        />
                    </div>
                </div>
            </div>

            <div className="glass-panel-premium rounded-2xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="min-w-full border-separate border-spacing-0">
                        <thead className="bg-black/20 sticky top-0 backdrop-blur-md z-10">
                            <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5">
                                <th className="p-5 pl-8 border-b border-white/5 bg-black/20 backdrop-blur-md">MAC Address</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">VLAN</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Learned on Device</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Connected Via</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Last Seen</th>
                                <th className="p-5 pr-8 text-right border-b border-white/5 bg-black/20 backdrop-blur-md">Action</th>
                            </tr>
                        </thead>
                        <motion.tbody
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="divide-y divide-white/5 bg-transparent"
                        >
                            <AnimatePresence>
                                {loading ? (
                                    <tr><td colSpan="6" className="p-0"><div className="p-12"><StatusMessage variant="loading" title="Scanning network..." /></div></td></tr>
                                ) : error ? (
                                    <tr><td colSpan="6" className="p-12"><StatusMessage variant="error" title={error} onRetry={loadMacs} /></td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="6" className="p-12"><StatusMessage variant="empty" title="No clients found." description="They will appear once polling discovers them." /></td></tr>
                                ) : (
                                    filtered.map((m, i) => (
                                        <motion.tr
                                            variants={itemVariants}
                                            key={i}
                                            className="group hover:bg-white/[0.03] transition duration-300 cursor-pointer relative"
                                        >
                                            <td className="p-5 pl-8 whitespace-nowrap text-sm font-mono text-gold-light/90 group-hover:text-gold transition font-bold border-b border-white/5">{m.mac}</td>
                                            <td className="p-5 whitespace-nowrap border-b border-white/5">
                                                <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5 group-hover:border-gold/10 transition">{m.vlan}</span>
                                            </td>
                                            <td className="p-5 whitespace-nowrap text-sm text-gray-300 border-b border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <Router className="w-3 h-3 text-gray-500" />
                                                    <span className="font-medium">{m.device_hostname || `Switch #${m.device_id}`}</span>
                                                </div>
                                                {m.device_mgmt_ip && (
                                                    <div className="text-xs text-gray-500 font-mono mt-1">{m.device_mgmt_ip}</div>
                                                )}
                                            </td>
                                            <td className="p-5 whitespace-nowrap text-sm text-gray-300 border-b border-white/5">
                                                <div className="font-mono bg-black/20 px-2 py-0.5 rounded w-fit text-gray-400">
                                                    {m.port_name || m.if_index || '-'}
                                                </div>
                                                <span className={clsx(
                                                    "ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border transition-all duration-300",
                                                    (m.port_oper_status || '').toLowerCase() === 'up'
                                                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                        : (m.port_oper_status || '').toLowerCase() === 'down'
                                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                            : "bg-gray-700/50 text-gray-500 border-gray-600/50"
                                                )}>
                                                    {m.port_oper_status || 'unknown'}
                                                </span>
                                                {m.port_descr && (
                                                    <div className="text-xs text-gray-500 mt-1">{m.port_descr}</div>
                                                )}
                                            </td>
                                            <td className="p-5 whitespace-nowrap text-xs text-gray-500 font-mono border-b border-white/5">
                                                {(() => {
                                                    const ts = parseAPITimestamp(m.last_seen);
                                                    return ts ? formatDistanceToNow(ts, { addSuffix: true }) : 'never';
                                                })()}
                                            </td>
                                            <td className="p-5 pr-8 whitespace-nowrap text-right border-b border-white/5">
                                                <button className="text-gray-500 hover:text-gold inline-flex items-center p-2 rounded-lg hover:bg-gold/10 transition duration-200">
                                                    <span className="text-xs font-semibold mr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0">Details</span>
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.tbody>
                    </table>
                </div>

                {/* Footer metadata */}
                <div className="bg-white/5 p-3 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-600 uppercase tracking-widest font-bold px-6">
                    <span>Total: {filtered.length} Endpoints</span>
                    <span>Scanner: Active</span>
                </div>
            </div>
        </motion.div>
    );
}
