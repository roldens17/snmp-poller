import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Search, Filter, MoreHorizontal, Database, Server, Plus, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { StatusMessage } from '../components/StatusMessage';
import { formatHost, formatLastSeen, getDeviceStatusInfo } from '../utils/deviceStatus';

export function Switches() {
    const [devices, setDevices] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadDevices = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getDevices();
            const list = Array.isArray(data) ? data : data.devices || [];
            setDevices(list);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to load switches', err);
            setError('Unable to load switches right now. Check the API URL and try again.');
            setDevices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDevices();
    }, []);

    const normalizedSearch = search.toLowerCase();
    const filtered = devices.filter(d => {
        const hostname = (d.hostname || '').toLowerCase();
        const mgmtIp = d.mgmt_ip || '';
        return hostname.includes(normalizedSearch) || mgmtIp.includes(search);
    });
    const noDevices = !loading && !error && devices.length === 0;
    const noMatches = !loading && !error && devices.length > 0 && filtered.length === 0;

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
                            <Server className="w-6 h-6 text-gold" />
                        </div>
                        <span className="text-glow">Switch Inventory</span>
                    </h1>
                    <p className="text-gray-400 mt-2 ml-1">Manage and monitor network infrastructure.</p>
                </div>

                <div className="flex space-x-3 w-full md:w-auto mt-4 md:mt-0">
                    <Link
                        to="/devices/new"
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold text-sm font-bold border border-gold/20 transition hover:shadow-gold/20 hover:shadow-lg"
                        style={{ color: '#D4AF37', borderColor: 'rgba(212, 175, 55, 0.2)' }}
                    >
                        <Plus className="w-4 h-4" />
                        Add Switch
                    </Link>
                    <button
                        onClick={loadDevices}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-sm font-semibold border border-white/10 transition"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <div className="relative flex-1 md:flex-initial group">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500 group-focus-within:text-gold transition" />
                        <input
                            type="text"
                            placeholder="Search Host, IP..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full md:w-72 pl-10 p-2.5 rounded-xl bg-rich-gray/50 border border-white/5 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 text-sm outline-none text-white placeholder-gray-500 transition-all shadow-inner"
                        />
                    </div>
                </div>
            </div>

            <div className="glass-panel-premium rounded-2xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="min-w-full border-separate border-spacing-0">
                        <thead className="bg-black/20 sticky top-0 backdrop-blur-md z-10">
                            <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5">
                                <th className="p-5 pl-8 border-b border-white/5 bg-black/20 backdrop-blur-md">Switch Name</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">IP Address</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Site</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Status</th>
                                <th className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">Last Seen</th>
                                <th className="p-5 pr-8 text-right border-b border-white/5 bg-black/20 backdrop-blur-md">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-transparent">
                            {loading ? (
                                <tr><td colSpan="6" className="p-0"><div className="p-12"><StatusMessage variant="loading" title="Loading switches..." /></div></td></tr>
                            ) : error ? (
                                <tr><td colSpan="6" className="p-12"><StatusMessage variant="error" title={error} onRetry={loadDevices} /></td></tr>
                            ) : noDevices ? (
                                <tr><td colSpan="6" className="p-12"><StatusMessage variant="empty" title="No switches discovered yet." description="They’ll appear here once polling finds devices." /></td></tr>
                            ) : noMatches ? (
                                <tr><td colSpan="6" className="p-12"><StatusMessage variant="empty" title="No switches match your search." /></td></tr>
                            ) : (
                                filtered.map(device => {
                                    const lastSeen = formatLastSeen(device.last_seen);
                                    const statusInfo = getDeviceStatusInfo(device.status, device.last_seen);

                                    return (
                                        <tr
                                            key={device.id}
                                            className="group hover:bg-white/[0.03] transition duration-300 cursor-pointer relative"
                                        >
                                            <td className="p-5 pl-8 whitespace-nowrap border-b border-white/5">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-lg bg-gold/5 border border-gold/10 flex items-center justify-center mr-3 text-gold/80 group-hover:scale-110 group-hover:bg-gold/10 group-hover:text-gold group-hover:border-gold/30 transition duration-300">
                                                        <Database className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-white group-hover:text-gold transition">{device.hostname}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 whitespace-nowrap text-sm text-gray-400 font-mono tracking-wide border-b border-white/5">{formatHost(device.mgmt_ip) || '-'}</td>
                                            <td className="p-5 whitespace-nowrap border-b border-white/5">
                                                <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5 group-hover:border-gold/10 transition">{device.site || 'Default'}</span>
                                            </td>
                                            <td className="p-5 whitespace-nowrap border-b border-white/5">
                                                <span className={clsx(
                                                    "px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full border shadow-sm transition-all duration-300",
                                                    statusInfo.className
                                                )}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="p-5 whitespace-nowrap text-xs text-gray-500 font-mono border-b border-white/5">
                                                {lastSeen instanceof Date ? formatDistanceToNow(lastSeen, { addSuffix: true }) : lastSeen}
                                            </td>
                                            <td className="p-5 pr-8 whitespace-nowrap text-right border-b border-white/5">
                                                <Link
                                                    to={`/devices/${device.id}`}
                                                    className="text-gray-500 hover:text-gold inline-flex items-center p-2 rounded-lg hover:bg-gold/10 transition duration-200"
                                                >
                                                    <span className="text-xs font-semibold mr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0">Manage</span>
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer metadata */}
                <div className="bg-white/5 p-3 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-600 uppercase tracking-widest font-bold px-6">
                    <span>Total: {filtered.length} Items</span>
                    <span>
                        {lastUpdated
                            ? `Last updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
                            : 'Waiting for first load'}
                    </span>
                </div>
            </div>
        </div>
    );
}
