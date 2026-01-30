import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { Briefcase } from 'lucide-react';
import { formatHost, getDeviceStatusInfo } from '../utils/deviceStatus';

export function DeviceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [interfaces, setInterfaces] = useState([]);
    const [macs, setMacs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [activeTab, setActiveTab] = useState('interfaces'); // 'interfaces' | 'macs'

    useEffect(() => {
        async function load() {
            try {
                const [d, i, m] = await Promise.all([
                    api.getDevice(id),
                    api.getDeviceInterfaces(id),
                    api.getDeviceMacs(id)
                ]);
                setDevice(d);
                setInterfaces(i.interfaces || []);
                setMacs(m.mac_entries || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-amber-500 animate-pulse">Loading Device Details...</div>;
    if (!device) return <div className="p-8 text-center text-red-400">Device not found</div>;

    const statusInfo = getDeviceStatusInfo(device.status, device.last_seen);

    const handleDelete = async () => {
        if (deleting) return;
        setDeleteError('');
        if (!window.confirm('Delete this device and all associated data?')) return;
        setDeleting(true);
        try {
            await api.deleteDevice(id);
            navigate('/devices', { replace: true });
        } catch (err) {
            console.error('Failed to delete device', err);
            setDeleteError('Unable to delete device right now.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 fade-in h-full">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="margin-0 text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Briefcase className="w-6 h-6 text-amber-400" />
                        {device.hostname}
                    </h1>
                    <div className="text-gray-400 mt-1 font-mono text-sm">{formatHost(device.mgmt_ip)} • {device.site}</div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={clsx(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                        statusInfo.className
                    )}>
                        {statusInfo.label}
                    </span>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    >
                        {deleting ? 'Deleting...' : 'Delete Device'}
                    </button>
                </div>
            </div>

            {deleteError && (
                <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {deleteError}
                </div>
            )}

            <div>
                <div className="flex space-x-4 border-b border-gray-700 mb-4">
                    <button
                        onClick={() => setActiveTab('interfaces')}
                        className={clsx(
                            "pb-2 text-sm font-medium transition duration-200",
                            activeTab === 'interfaces' ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-400 hover:text-gray-200"
                        )}
                    >
                        Interfaces ({interfaces.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('macs')}
                        className={clsx(
                            "pb-2 text-sm font-medium transition duration-200",
                            activeTab === 'macs' ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-400 hover:text-gray-200"
                        )}
                    >
                        MAC Table ({macs.length})
                    </button>
                </div>

                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                    {activeTab === 'interfaces' ? (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800">
                                    <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        <th className="p-4">Index</th>
                                        <th className="p-4">Name</th>
                                        <th className="p-4">Oper Status</th>
                                        <th className="p-4">Speed</th>
                                        <th className="p-4">In Octets</th>
                                        <th className="p-4">Out Octets</th>
                                        <th className="p-4">Errors</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {interfaces.map(iface => (
                                        <tr key={iface.if_index} className="border-b border-gray-700 hover:bg-gray-700/50">
                                            <td className="p-4 text-xs text-gray-500 font-mono">{iface.if_index}</td>
                                            <td className="p-4 font-medium text-gray-200">
                                                {iface.if_name}
                                                <div className="text-xs text-gray-500 font-normal">{iface.if_descr}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={clsx(
                                                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                                                    iface.oper_status.toLowerCase() === 'up' ? "bg-green-900/50 text-green-300" : "bg-gray-700 text-gray-400"
                                                )}>
                                                    {iface.oper_status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-300">
                                                {iface.speed > 0 ? (iface.speed / 1000000) + ' Mbps' : '-'}
                                            </td>
                                            <td className="p-4 text-xs font-mono text-gray-400">{(iface.in_octets || 0).toLocaleString()}</td>
                                            <td className="p-4 text-xs font-mono text-gray-400">{(iface.out_octets || 0).toLocaleString()}</td>
                                            <td className={clsx("p-4 text-xs font-mono", ((iface.in_errors || 0) + (iface.out_errors || 0)) > 0 ? "text-red-400 font-bold" : "text-gray-500")}>
                                                {(iface.in_errors || 0) + (iface.out_errors || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800">
                                    <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        <th className="p-4">VLAN</th>
                                        <th className="p-4">MAC Address</th>
                                        <th className="p-4">Port Index</th>
                                        <th className="p-4">Last Seen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {macs.length === 0 ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">No MAC entries found.</td></tr>
                                    ) : macs.map((m, i) => (
                                        <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/50">
                                            <td className="p-4 text-sm">
                                                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs font-mono">{m.vlan}</span>
                                            </td>
                                            <td className="p-4 text-sm font-mono text-amber-500">{m.mac}</td>
                                            <td className="p-4 text-sm text-gray-400">{m.learned_port}</td>
                                            <td className="p-4 text-xs text-gray-500 font-mono">{m.last_seen ? `${formatDistanceToNow(new Date(m.last_seen))} ago` : 'never'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
