import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Search, Filter, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { StatusMessage } from '../components/StatusMessage';

export function Devices() {
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

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 fade-in h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-100">Device Inventory <span className="text-gray-500 text-base font-normal">({macs.length})</span></h2>
                <div className="flex mt-4 md:mt-0 space-x-2 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-initial">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search MAC Address..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full md:w-64 pl-10 p-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm outline-none text-white placeholder-gray-500"
                        />
                    </div>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg border border-gray-600 transition">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800 sticky top-0">
                        <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <th className="p-4">MAC Address</th>
                            <th className="p-4">VLAN</th>
                            <th className="p-4">Learned on Device</th>
                            <th className="p-4">Port Index</th>
                            <th className="p-4">Last Seen</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr><td colSpan="6" className="p-6"><StatusMessage variant="loading" title="Scanning network..." /></td></tr>
                        ) : error ? (
                            <tr><td colSpan="6" className="p-6"><StatusMessage variant="error" title={error} onRetry={loadMacs} /></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="6" className="p-6"><StatusMessage variant="empty" title="No devices found." description="They will appear once polling discovers them." /></td></tr>
                        ) : (
                            filtered.map((m, i) => (
                                <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/50 transition duration-150 cursor-pointer group">
                                    <td className="p-4 whitespace-nowrap text-sm font-mono text-amber-500 group-hover:text-amber-300 transition">{m.mac}</td>
                                    <td className="p-4 whitespace-nowrap text-sm text-gray-300 font-mono">{m.vlan}</td>
                                    <td className="p-4 whitespace-nowrap text-sm text-gray-300">Switch #{m.device_id}</td>
                                    <td className="p-4 whitespace-nowrap text-sm text-gray-400">{m.learned_port || m.if_index}</td>
                                    <td className="p-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                        {formatDistanceToNow(new Date(m.last_seen), { addSuffix: true })}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <button className="text-gray-400 hover:text-amber-400 text-sm flex items-center transition">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
