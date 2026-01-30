import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Trash2, Plus, Bell, CheckCircle, AlertCircle, Settings as SettingsIcon, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

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
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8 max-w-4xl mx-auto"
        >
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
                    <SettingsIcon className="w-6 h-6 text-gold" />
                </div>
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold to-white text-glow">
                    System Settings
                </h2>
            </div>

            <div className="glass-panel-premium rounded-2xl p-8 border border-gold/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-gold/5 rounded-full blur-3xl"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-gold" />
                            Webhook Destinations
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">Manage where system alerts are sent.</p>
                    </div>

                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-gold text-black hover:bg-gold-light rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition duration-300 transform hover:-translate-y-0.5"
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancel' : 'Add Webhook'}
                    </button>
                </div>

                <AnimatePresence>
                    {showForm && (
                        <motion.form
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={handleSubmit}
                            className="mb-8 p-6 bg-black/30 rounded-xl border border-gold/20 shadow-inner overflow-hidden"
                        >
                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">Friendly Name</label>
                                    <input
                                        className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold focus:ring-1 focus:ring-gold/50 focus:outline-none transition"
                                        placeholder="e.g. Slack NOC Channel"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">Webhook URL</label>
                                    <input
                                        className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold focus:ring-1 focus:ring-gold/50 focus:outline-none transition font-mono"
                                        placeholder="https://hooks.slack.com/..."
                                        value={formData.url}
                                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-gradient-to-r from-gold to-yellow-600 text-black rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-gold/20 transition flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Destination
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="space-y-3">
                    {loading ? (
                        <div className="p-8 text-center text-gold animate-pulse text-sm font-mono uppercase tracking-widest">Loading configuration...</div>
                    ) : dests.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic border border-dashed border-gray-700 rounded-xl">No webhooks configured yet.</div>
                    ) : (
                        <AnimatePresence>
                            {dests.map(d => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    key={d.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-gold/30 hover:bg-white/10 transition duration-300 group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-200 group-hover:text-gold transition">{d.name}</span>
                                        <span className="text-xs text-gray-500 font-mono mt-1 opacity-70 group-hover:opacity-100 transition">{d.url}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => toggleEnabled(d)}
                                            className={clsx(
                                                "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition duration-300",
                                                d.is_enabled
                                                    ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                                    : "bg-gray-700/30 text-gray-500 border-gray-600/30 hover:bg-gray-700/50"
                                            )}
                                        >
                                            {d.is_enabled ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                            {d.is_enabled ? 'Active' : 'Disabled'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(d.id)}
                                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
