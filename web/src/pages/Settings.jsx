import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Trash2, Plus, Bell, CheckCircle, AlertCircle } from 'lucide-react';

export function Settings() {
    const [dests, setDests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({ name: '', url: '', is_enabled: true });

    useEffect(() => {
        loadDestinations();
    }, []);

    const loadDestinations = async () => {
        setLoading(true);
        try {
            const res = await api.getAlertDestinations();
            setDests(res.destinations || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createAlertDestination({ ...formData, type: 'webhook' });
            setShowForm(false);
            setFormData({ name: '', url: '', is_enabled: true });
            loadDestinations();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this webhook?')) return;
        try {
            await api.deleteAlertDestination(id);
            loadDestinations();
        } catch (err) {
            alert(err.message);
        }
    };

    const toggleEnabled = async (d) => {
        try {
            await api.updateAlertDestination(d.id, { is_enabled: !d.is_enabled });
            loadDestinations();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-600">
                Alert Settings
            </h2>

            <div className="bg-rich-gray/50 backdrop-blur-sm border border-gold/10 rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-gold" /> Webhook Destinations
                    </h3>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg text-gold text-sm transition"
                    >
                        <Plus className="w-4 h-4" /> Add Webhook
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-black/20 rounded-lg border border-gold/10">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Name</label>
                                <input
                                    className="w-full bg-rich-black border border-gray-700 rounded p-2 text-sm text-white focus:border-gold focus:outline-none"
                                    placeholder="e.g. Slack NOC"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Webhook URL</label>
                                <input
                                    className="w-full bg-rich-black border border-gray-700 rounded p-2 text-sm text-white focus:border-gold focus:outline-none"
                                    placeholder="https://hooks.slack.com/..."
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-gray-400 hover:text-white text-sm">Cancel</button>
                            <button type="submit" className="px-3 py-1 bg-gold text-black rounded text-sm hover:bg-yellow-500 font-medium">Save</button>
                        </div>
                    </form>
                )}

                {loading ? (
                    <div className="text-gray-500 text-sm animate-pulse">Loading settings...</div>
                ) : dests.length === 0 ? (
                    <div className="text-gray-500 text-sm italic">No webhooks configured.</div>
                ) : (
                    <div className="space-y-3">
                        {dests.map(d => (
                            <div key={d.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-gold/10 transition">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-200">{d.name}</span>
                                    <span className="text-xs text-gray-500 font-mono">{d.url}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => toggleEnabled(d)}
                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition ${d.is_enabled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-700/30 text-gray-500 border-gray-600/30'}`}
                                    >
                                        {d.is_enabled ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {d.is_enabled ? 'Active' : 'Disabled'}
                                    </button>
                                    <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-300 transition">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
