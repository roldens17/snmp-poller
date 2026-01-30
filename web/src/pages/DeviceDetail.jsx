import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { Briefcase, Activity, Shield, Trash2, ArrowLeft } from 'lucide-react';
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full text-gold animate-pulse tracking-widest uppercase">
            <Activity className="w-10 h-10 mb-4 animate-spin-slow" />
            Loading Device Details...
        </div>
    );

    if (!device) return <div className="p-8 text-center text-red-400 glass-panel border-red-500/20 rounded-xl">Device not found</div>;

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
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4 glass-panel-premium p-6 rounded-2xl">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="margin-0 text-2xl font-bold text-gray-100 flex items-center gap-3 text-glow">
                            <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                                <Briefcase className="w-5 h-5 text-gold" />
                            </div>
                            {device.hostname}
                        </h1>
                        <div className="text-gray-400 mt-1 font-mono text-sm pl-1">{formatHost(device.mgmt_ip)} • <span className="text-gold/70">{device.site}</span></div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={clsx(
                        "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border shadow-lg",
                        statusInfo.className
                    )}>
                        {statusInfo.label}
                    </span>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 group"
                    >
                        <Trash2 className="w-4 h-4 group-hover:text-red-500" />
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>

            {deleteError && (
                <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 animate-pulse">
                    {deleteError}
                </div>
            )}

            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex space-x-1 p-2 bg-black/20 border-b border-white/5">
                    {['interfaces', 'macs'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition duration-300 relative overflow-hidden",
                                activeTab === tab ? "text-gold bg-white/5 shadow-inner" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            )}
                        >
                            {activeTab === tab && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gold shadow-[0_0_10px_#D4AF37]" />}
                            {tab === 'interfaces' ? `Interfaces (${interfaces.length})` : `MAC Table (${macs.length})`}
                        </button>
                    ))}
                </div>

                <div className="">
                    {activeTab === 'interfaces' ? (
                        <table className="min-w-full">
                            <thead className="bg-white/5">
                                <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-white/5">
                                    <th className="p-4 pl-6">Index</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Speed</th>
                                    <th className="p-4">In Octets</th>
                                    <th className="p-4">Out Octets</th>
                                    <th className="p-4 pr-6">Errors</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {interfaces.map(iface => (
                                    <tr key={iface.if_index} className="hover:bg-white/5 transition duration-150">
                                        <td className="p-4 pl-6 text-xs text-gray-500 font-mono">{iface.if_index}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-200">{iface.if_name}</div>
                                            <div className="text-xs text-gray-500 font-normal">{iface.if_descr}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                                                iface.oper_status.toLowerCase() === 'up'
                                                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                    : "bg-gray-700/50 text-gray-500 border-gray-600/50"
                                            )}>
                                                {iface.oper_status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-300 font-mono">
                                            {iface.speed > 0 ? (iface.speed / 1000000) + ' Mbps' : '-'}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-400 opacity-70">{(iface.in_octets || 0).toLocaleString()}</td>
                                        <td className="p-4 text-xs font-mono text-gray-400 opacity-70">{(iface.out_octets || 0).toLocaleString()}</td>
                                        <td className="p-4 pr-6">
                                            <span className={clsx("text-xs font-mono px-2 py-0.5 rounded", ((iface.in_errors || 0) + (iface.out_errors || 0)) > 0 ? "bg-red-500/20 text-red-400 border border-red-500/20" : "text-gray-500")}>
                                                {(iface.in_errors || 0) + (iface.out_errors || 0)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="min-w-full">
                            <thead className="bg-white/5">
                                <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-white/5">
                                    <th className="p-4 pl-6">VLAN</th>
                                    <th className="p-4">MAC Address</th>
                                    <th className="p-4">Connected Via</th>
                                    <th className="p-4 pr-6">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {macs.length === 0 ? (
                                    <tr><td colSpan="4" className="p-12 text-center text-gray-500 italic">No MAC entries found.</td></tr>
                                ) : macs.map((m, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition duration-150 group">
                                        <td className="p-4 pl-6">
                                            <span className="bg-white/10 text-gray-300 px-2 py-0.5 rounded text-xs font-mono border border-white/10">{m.vlan}</span>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-gold-light group-hover:text-gold transition shadow-gold/5">{m.mac}</td>
                                        <td className="p-4 text-sm text-gray-300">
                                            <div className="font-mono bg-black/20 rounded px-2 py-0.5 inline-block text-gray-400">
                                                {m.port_name || m.if_index || '-'}
                                            </div>
                                            <span className={clsx(
                                                "ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
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
                                        <td className="p-4 pr-6 text-xs text-gray-500 font-mono tracking-wide">{m.last_seen ? `${formatDistanceToNow(new Date(m.last_seen))} ago` : 'never'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
