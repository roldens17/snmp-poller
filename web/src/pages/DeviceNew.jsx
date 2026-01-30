import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../api';
import { CheckCircle2, Loader2, PlugZap, ShieldAlert, ChevronDown, Save, X, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const deviceTypes = ['switch', 'router', 'firewall', 'wlc', 'other'];

function formatUptime(seconds) {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (parts.length === 0) return `${seconds}s`;
    return parts.join(' ');
}

function normalizeTags(raw) {
    return raw
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
}

function normalizeAddress(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    const slashIndex = trimmed.indexOf('/');
    if (slashIndex >= 0) {
        return trimmed.slice(0, slashIndex).trim();
    }
    return trimmed;
}

export function DeviceNew() {
    const navigate = useNavigate();
    const [deviceName, setDeviceName] = useState('');
    const [ipOrHostname, setIpOrHostname] = useState('');
    const [deviceType, setDeviceType] = useState('switch');
    const [snmpVersion, setSnmpVersion] = useState('2c');
    const [community, setCommunity] = useState('');
    const [v3, setV3] = useState({
        username: '',
        auth_protocol: 'SHA',
        auth_password: '',
        priv_protocol: 'AES',
        priv_password: '',
    });
    const [pollingInterval, setPollingInterval] = useState(60);
    const [tagsInput, setTagsInput] = useState('');
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const [testState, setTestState] = useState({
        status: 'idle',
        result: null,
        error: '',
        token: '',
        testedAt: '',
    });
    const [saveState, setSaveState] = useState({ status: 'idle', error: '' });
    const [duplicateState, setDuplicateState] = useState({ deviceId: null, ip: '', show: false });

    const snmpPayload = useMemo(() => {
        if (snmpVersion === '2c') {
            return { version: '2c', community };
        }
        return { version: '3', v3: { ...v3 } };
    }, [snmpVersion, community, v3]);

    const testKey = useMemo(() => {
        return JSON.stringify({
            deviceName,
            ipOrHostname,
            deviceType,
            snmpVersion,
            community,
            v3,
            pollingInterval,
            tagsInput,
        });
    }, [deviceName, ipOrHostname, deviceType, snmpVersion, community, v3, pollingInterval, tagsInput]);

    useEffect(() => {
        setTestState(prev => ({ ...prev, status: 'idle', result: null, error: '', token: '', testedAt: '' }));
    }, [testKey]);

    const canTest = deviceName.trim() && ipOrHostname.trim() && deviceType;
    const canSave = testState.status === 'success' && testState.token && saveState.status !== 'saving';

    const validateBeforeTest = () => {
        if (!deviceName.trim() || !ipOrHostname.trim()) {
            return 'Device name and IP/hostname are required.';
        }
        if (snmpVersion === '2c' && !community.trim()) {
            return 'SNMP community is required for v2c.';
        }
        if (snmpVersion === '3') {
            const missing = Object.values(v3).some(val => !String(val).trim());
            if (missing) {
                return 'All SNMPv3 fields are required.';
            }
        }
        return '';
    };

    const handleTest = async () => {
        const error = validateBeforeTest();
        if (error) {
            setTestState({ status: 'error', result: null, error, token: '', testedAt: '' });
            return;
        }
        setTestState({ status: 'testing', result: null, error: '', token: '', testedAt: '' });
        const normalizedIP = normalizeAddress(ipOrHostname);
        try {
            const response = await api.testSnmp({
                ip: normalizedIP,
                snmp: snmpPayload,
            });
            if (response.ok === false) {
                setTestState({ status: 'error', result: null, error: response.message || 'SNMP test failed.', token: '', testedAt: '' });
                return;
            }
            setTestState({
                status: 'success',
                result: response,
                error: '',
                token: response.test_token,
                testedAt: new Date().toISOString(),
            });
        } catch (err) {
            setTestState({ status: 'error', result: null, error: 'Unable to reach SNMP test service.', token: '', testedAt: '' });
        }
    };

    const handleSave = async () => {
        setSaveState({ status: 'saving', error: '' });
        setDuplicateState({ deviceId: null, ip: '', show: false });
        const normalizedIP = normalizeAddress(ipOrHostname);
        try {
            const payload = {
                device_name: deviceName.trim(),
                ip_or_hostname: normalizedIP,
                device_type: deviceType,
                snmp: snmpPayload,
                polling_interval_seconds: Number(pollingInterval) || 60,
                tags: normalizeTags(tagsInput),
                test_token: testState.token,
            };
            const created = await api.createDevice(payload);
            setSaveState({ status: 'idle', error: '' });
            navigate(`/devices/${created.id}`);
        } catch (err) {
            if (err?.status === 409 && err?.body?.error_code === 'DEVICE_EXISTS') {
                setDuplicateState({ deviceId: err.body.device_id, ip: err.body.ip || normalizedIP, show: true });
                setSaveState({ status: 'idle', error: '' });
                setTimeout(() => {
                    navigate(`/devices/${err.body.device_id}`);
                }, 800);
                return;
            }
            setSaveState({ status: 'idle', error: 'Unable to save device. Please retry.' });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-8 max-w-5xl mx-auto pb-10"
        >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
                            <Server className="w-6 h-6 text-gold" />
                        </div>
                        <span className="text-glow">Register New Device</span>
                    </h1>
                    <p className="text-sm text-gray-400 mt-2 ml-1">Onboard a new endpoint for monitoring.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
                        onClick={() => navigate('/devices')}
                    >
                        <X className="w-4 h-4" />
                        Cancel
                    </button>
                    <button
                        className={clsx(
                            "px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg",
                            canSave
                                ? "bg-gradient-to-r from-gold to-yellow-600 text-black hover:shadow-gold/20 cursor-pointer"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                        )}
                        disabled={!canSave}
                        onClick={handleSave}
                    >
                        {saveState.status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save & Monitor
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {duplicateState.show && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-amber-900/20 border border-amber-500/30 text-amber-100 px-6 py-4 rounded-xl flex items-center justify-between gap-4 backdrop-blur-sm"
                    >
                        <div>
                            <p className="font-bold">Device already exists</p>
                            <p className="text-sm text-amber-200/80 mt-1">Found duplicate with IP {duplicateState.ip}. Redirecting...</p>
                        </div>
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </motion.div>
                )}
                {saveState.error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-red-900/20 border border-red-500/30 text-red-100 px-6 py-4 rounded-xl"
                    >
                        {saveState.error}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    <motion.section
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-panel-premium p-8 rounded-2xl relative overflow-hidden"
                    >
                        <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-wider text-gold/80 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block"></span>
                            Device Basics
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Device Name</label>
                                <input
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition"
                                    placeholder="SW-CORE-01"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">IP or Hostname</label>
                                <input
                                    value={ipOrHostname}
                                    onChange={(e) => setIpOrHostname(e.target.value)}
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition font-mono"
                                    placeholder="192.168.1.10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Device Type</label>
                                <div className="relative">
                                    <select
                                        value={deviceType}
                                        onChange={(e) => setDeviceType(e.target.value)}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition appearance-none cursor-pointer uppercase text-sm"
                                    >
                                        {deviceTypes.map(type => (
                                            <option key={type} value={type}>{type.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-panel-premium p-8 rounded-2xl relative overflow-hidden"
                    >
                        <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-wider text-gold/80 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block"></span>
                            SNMP Config
                        </h2>

                        <div className="flex items-center gap-6 mb-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={clsx("w-5 h-5 rounded-full border flex items-center justify-center transition", snmpVersion === '2c' ? "border-gold bg-gold/10" : "border-gray-600 bg-transparent")}>
                                    {snmpVersion === '2c' && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                                </div>
                                <input
                                    type="radio"
                                    className="hidden"
                                    checked={snmpVersion === '2c'}
                                    onChange={() => setSnmpVersion('2c')}
                                />
                                <span className={clsx("text-sm font-bold transition", snmpVersion === '2c' ? "text-white" : "text-gray-400 group-hover:text-gray-300")}>SNMP v2c</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={clsx("w-5 h-5 rounded-full border flex items-center justify-center transition", snmpVersion === '3' ? "border-gold bg-gold/10" : "border-gray-600 bg-transparent")}>
                                    {snmpVersion === '3' && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                                </div>
                                <input
                                    type="radio"
                                    className="hidden"
                                    checked={snmpVersion === '3'}
                                    onChange={() => setSnmpVersion('3')}
                                />
                                <span className={clsx("text-sm font-bold transition", snmpVersion === '3' ? "text-white" : "text-gray-400 group-hover:text-gray-300")}>SNMP v3</span>
                            </label>
                        </div>

                        {snmpVersion === '2c' ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Community String</label>
                                <input
                                    type="password"
                                    value={community}
                                    onChange={(e) => setCommunity(e.target.value)}
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition font-mono"
                                    placeholder="public"
                                />
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Security Name (Username)</label>
                                    <input
                                        value={v3.username}
                                        onChange={(e) => setV3(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Auth Protocol</label>
                                    <div className="relative">
                                        <select
                                            value={v3.auth_protocol}
                                            onChange={(e) => setV3(prev => ({ ...prev, auth_protocol: e.target.value }))}
                                            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition appearance-none cursor-pointer text-sm"
                                        >
                                            <option value="SHA">SHA</option>
                                            <option value="MD5">MD5</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Auth Password</label>
                                    <input
                                        type="password"
                                        value={v3.auth_password}
                                        onChange={(e) => setV3(prev => ({ ...prev, auth_password: e.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Privacy Protocol</label>
                                    <div className="relative">
                                        <select
                                            value={v3.priv_protocol}
                                            onChange={(e) => setV3(prev => ({ ...prev, priv_protocol: e.target.value }))}
                                            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition appearance-none cursor-pointer text-sm"
                                        >
                                            <option value="AES">AES</option>
                                            <option value="DES">DES</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Privacy Password</label>
                                    <input
                                        type="password"
                                        value={v3.priv_password}
                                        onChange={(e) => setV3(prev => ({ ...prev, priv_password: e.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </motion.section>
                </div>

                <div className="flex flex-col gap-8">
                    <motion.section
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-panel-premium p-6 rounded-2xl shadow-xl border border-gold/10 bg-gradient-to-br from-white/5 to-black/40"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-gold/80 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block"></span>
                            Actions
                        </h2>

                        {testState.status === 'idle' && (
                            <p className="text-sm text-gray-400 mb-4 bg-black/20 p-3 rounded-lg border border-white/5">
                                Run a test to verify SNMP reachability before monitoring.
                            </p>
                        )}

                        <button
                            className={clsx(
                                "w-full py-3 rounded-xl border font-bold transition flex items-center justify-center gap-2 shadow-lg mb-4",
                                canTest && testState.status !== 'testing'
                                    ? "border-amber-500 text-amber-300 hover:bg-amber-500/10 hover:shadow-amber-500/20"
                                    : "border-gray-700 text-gray-600 cursor-not-allowed bg-black/20"
                            )}
                            disabled={!canTest || testState.status === 'testing'}
                            onClick={handleTest}
                        >
                            {testState.status === 'testing' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <PlugZap className="w-4 h-4" />
                            )}
                            {testState.status === 'testing' ? 'Testing...' : 'Test SNMP Connection'}
                        </button>

                        <AnimatePresence>
                            {testState.status === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="bg-red-900/20 border border-red-500/30 text-red-200 p-4 rounded-xl flex gap-3"
                                >
                                    <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                                    <div>
                                        <p className="font-bold text-xs uppercase tracking-wider text-red-400">Connection Failed</p>
                                        <p className="text-sm mt-1 leading-tight">{testState.error}</p>
                                    </div>
                                </motion.div>
                            )}

                            {testState.status === 'success' && testState.result && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-green-900/10 border border-green-500/20 rounded-xl p-4"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        <span className="font-bold text-white text-sm">Connection Successful</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs border-b border-white/5 pb-1">
                                            <span className="text-gray-400">SysName</span>
                                            <span className="text-green-300 font-mono text-right">{testState.result.sys_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-b border-white/5 pb-1">
                                            <span className="text-gray-400">Interfaces</span>
                                            <span className="text-green-300 font-mono text-right">{testState.result.interfaces_count}</span>
                                        </div>
                                        <div className="flex justify-between text-xs pb-1">
                                            <span className="text-gray-400">Uptime</span>
                                            <span className="text-green-300 font-mono text-right">{formatUptime(testState.result.uptime_seconds)}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-panel-premium p-6 rounded-2xl relative overflow-hidden"
                    >
                        <button
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            className="w-full flex items-center justify-between text-left font-bold text-white uppercase tracking-wider text-xs group"
                        >
                            Advanced Settings
                            <ChevronDown className={clsx("w-4 h-4 transition text-gray-500 group-hover:text-gold", advancedOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {advancedOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Polling Interval (seconds)</label>
                                        <input
                                            type="number"
                                            value={pollingInterval}
                                            min={10}
                                            onChange={(e) => setPollingInterval(e.target.value)}
                                            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Tags (comma separated)</label>
                                        <input
                                            value={tagsInput}
                                            onChange={(e) => setTagsInput(e.target.value)}
                                            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition"
                                            placeholder="core, dc1"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.section>
                </div>
            </div>
        </motion.div>
    );
}
