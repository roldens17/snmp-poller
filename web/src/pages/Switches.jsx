import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Search, Filter, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function Switches() {
    const [devices, setDevices] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getDevices().then(data => {
            setDevices(data.devices || []);
            setLoading(false);
        });
    }, []);

    const filtered = devices.filter(d =>
        d.hostname.toLowerCase().includes(search.toLowerCase()) ||
        d.mgmt_ip.includes(search)
    );

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 fade-in h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-100">Switch Inventory <span className="text-gray-500 text-base font-normal">({devices.length})</span></h2>
                <div className="flex mt-4 md:mt-0 space-x-2 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-initial">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search Host, IP..."
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
                            <th className="p-4">Switch Name</th>
                            <th className="p-4">IP Address</th>
                            <th className="p-4">Site</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Last Seen</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500 animate-pulse">Loading Switches...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">No switches found</td></tr>
                        ) : (
                            filtered.map(device => {
                                const lastSeen = new Date(device.last_seen);
                                const isOnline = (new Date() - lastSeen) < 120000;

                                return (
                                    <tr key={device.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition duration-150 cursor-pointer group">
                                        <td className="p-4 whitespace-nowrap text-sm font-bold text-amber-500 group-hover:text-amber-300 transition">{device.hostname}</td>
                                        <td className="p-4 whitespace-nowrap text-sm text-gray-300 font-mono">{device.mgmt_ip}</td>
                                        <td className="p-4 whitespace-nowrap text-sm text-gray-300">{device.site || '-'}</td>
                                        <td className="p-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border",
                                                isOnline ? "bg-green-900 text-green-200 border-green-800" : "bg-red-900 text-red-200 border-red-800"
                                            )}>
                                                {isOnline ? 'Healthy' : 'Offline'}
                                            </span>
                                        </td>
                                        <td className="p-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                            {formatDistanceToNow(lastSeen, { addSuffix: true })}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            <Link to={`/devices/${device.id}`} className="text-gray-400 hover:text-amber-400 text-sm flex items-center transition">
                                                Manage <MoreHorizontal className="w-4 h-4 ml-1" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
