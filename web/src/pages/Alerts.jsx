import { useEffect, useState } from 'react';
import { api } from '../api';
import { Octagon, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function Alerts() {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        api.getAlerts(true).then(data => setAlerts(data.alerts || []));
    }, []);

    const getSeverityColor = (severity) => {
        if (severity === 'critical') return 'bg-red-900 text-red-200 border border-red-700';
        if (severity === 'warning') return 'bg-amber-900 text-amber-200 border border-amber-700';
        return 'bg-gray-700 text-gray-300 border border-gray-600';
    }

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 fade-in h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Alert History</h2>
                <div className="flex space-x-4 mt-4 md:mt-0">
                    <select className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none">
                        <option>Severity: All</option>
                        <option>Critical</option>
                        <option>Major</option>
                    </select>
                    <select className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none">
                        <option>Type: All</option>
                        <option>Ups/Downs</option>
                        <option>Errors</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800 sticky top-0">
                        <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <th className="p-4 w-12"></th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Source</th>
                            <th className="p-4">Severity</th>
                            <th className="p-4">Time</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {alerts.map(a => (
                            <tr key={a.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition duration-150 cursor-pointer group">
                                <td className="p-4 whitespace-nowrap">
                                    <span className={clsx("p-1.5 rounded-full inline-block", getSeverityColor(a.severity))}>
                                        {a.severity === 'critical' ? <Octagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    </span>
                                </td>
                                <td className="p-4 whitespace-nowrap text-sm font-semibold text-gray-200">{a.category}</td>
                                <td className="p-4 whitespace-nowrap text-sm text-amber-500 font-mono">Device #{a.device_id}</td>
                                <td className="p-4 whitespace-nowrap">
                                    <span className={clsx("px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full", getSeverityColor(a.severity))}>
                                        {a.severity}
                                    </span>
                                </td>
                                <td className="p-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                    {formatDistanceToNow(new Date(a.triggered_at))} ago
                                </td>
                                <td className="p-4 whitespace-nowrap text-sm">
                                    <button className="text-gray-500 group-hover:text-amber-400 transition duration-150 flex items-center">
                                        Investigate <ArrowRight className="w-4 h-4 ml-1" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {alerts.length === 0 && (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">No active alerts recorded.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
