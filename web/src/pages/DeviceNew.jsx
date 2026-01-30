import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../api';
import { CheckCircle2, Loader2, PlugZap, ShieldAlert, ChevronDown } from 'lucide-react';

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
        <div className="flex flex-col gap-6 fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100">Register New Device</h1>
                    <p className="text-sm text-gray-400 mt-1">Test SNMP access before adding the device to monitoring.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-amber-400 transition"
                        onClick={() => navigate('/devices')}
                    >
                        Cancel
                    </button>
                    <button
                        className={clsx(
                            "px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2",
                            canSave
                                ? "bg-amber-500 text-black hover:bg-amber-400"
                                : "bg-gray-700 text-gray-400 cursor-not-allowed"
                        )}
                        disabled={!canSave}
                        onClick={handleSave}
                    >
                        {saveState.status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                        Save & Start Monitoring
                    </button>
                </div>
            </div>

            {duplicateState.show && (
                <div className="bg-amber-900/30 border border-amber-700 text-amber-100 px-4 py-3 rounded-lg flex items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold">Device already exists — opening it now.</p>
                        <p className="text-xs text-amber-200">IP {duplicateState.ip}</p>
                    </div>
                    <button
                        className="px-3 py-2 rounded-md bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition"
                        onClick={() => navigate(`/devices/${duplicateState.deviceId}`)}
                    >
                        Go to Device
                    </button>
                </div>
            )}
            {saveState.error && (
                <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                    {saveState.error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-100 mb-4">Device Basics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400">Device Name</label>
                                <input
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    placeholder="SW-CORE-01"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">IP or Hostname</label>
                                <input
                                    value={ipOrHostname}
                                    onChange={(e) => setIpOrHostname(e.target.value)}
                                    className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    placeholder="192.168.1.10"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Device Type</label>
                                <select
                                    value={deviceType}
                                    onChange={(e) => setDeviceType(e.target.value)}
                                    className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                >
                                    {deviceTypes.map(type => (
                                        <option key={type} value={type}>{type.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-100 mb-4">SNMP Config</h2>
                        <div className="flex items-center gap-4 mb-4">
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="radio"
                                    checked={snmpVersion === '2c'}
                                    onChange={() => setSnmpVersion('2c')}
                                />
                                v2c
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="radio"
                                    checked={snmpVersion === '3'}
                                    onChange={() => setSnmpVersion('3')}
                                />
                                v3
                            </label>
                        </div>

                        {snmpVersion === '2c' ? (
                            <div>
                                <label className="text-sm text-gray-400">Community</label>
                                <input
                                    type="password"
                                    value={community}
                                    onChange={(e) => setCommunity(e.target.value)}
                                    className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    placeholder="public"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400">Username</label>
                                    <input
                                        value={v3.username}
                                        onChange={(e) => setV3(prev => ({ ...prev, username: e.target.value }))}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Auth Protocol</label>
                                    <select
                                        value={v3.auth_protocol}
                                        onChange={(e) => setV3(prev => ({ ...prev, auth_protocol: e.target.value }))}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    >
                                        <option value="SHA">SHA</option>
                                        <option value="MD5">MD5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Auth Password</label>
                                    <input
                                        type="password"
                                        value={v3.auth_password}
                                        onChange={(e) => setV3(prev => ({ ...prev, auth_password: e.target.value }))}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Privacy Protocol</label>
                                    <select
                                        value={v3.priv_protocol}
                                        onChange={(e) => setV3(prev => ({ ...prev, priv_protocol: e.target.value }))}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    >
                                        <option value="AES">AES</option>
                                        <option value="DES">DES</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Privacy Password</label>
                                    <input
                                        type="password"
                                        value={v3.priv_password}
                                        onChange={(e) => setV3(prev => ({ ...prev, priv_password: e.target.value }))}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-100">Test Connection</h2>
                            <button
                                className={clsx(
                                    "px-4 py-2 rounded-lg border text-sm font-semibold transition flex items-center gap-2",
                                    canTest
                                        ? "border-amber-500 text-amber-300 hover:bg-amber-500/10"
                                        : "border-gray-600 text-gray-500 cursor-not-allowed"
                                )}
                                disabled={!canTest || testState.status === 'testing'}
                                onClick={handleTest}
                            >
                                {testState.status === 'testing' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <PlugZap className="w-4 h-4" />
                                )}
                                Test SNMP Connection
                            </button>
                        </div>
                        {testState.status === 'idle' && (
                            <p className="text-sm text-gray-400">Run a test to verify SNMP reachability before saving.</p>
                        )}
                        {testState.status === 'error' && (
                            <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-start gap-2">
                                <ShieldAlert className="w-5 h-5 mt-0.5" />
                                <div>
                                    <p className="font-semibold">SNMP test failed</p>
                                    <p className="text-sm">{testState.error}</p>
                                </div>
                            </div>
                        )}
                        {testState.status === 'success' && testState.result && (
                            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-sm text-green-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-300" />
                                    <span className="font-semibold">SNMP reachable</span>
                                    {testState.testedAt && (
                                        <span className="text-xs text-green-300">• tested just now</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-green-200">System Name</p>
                                        <p className="text-white font-mono">{testState.result.sys_name || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-green-200">Interfaces</p>
                                        <p className="text-white font-mono">{testState.result.interfaces_count || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-green-200">Uptime</p>
                                        <p className="text-white font-mono">{formatUptime(testState.result.uptime_seconds)}</p>
                                    </div>
                                    <div>
                                        <p className="text-green-200">MAC Table</p>
                                        <p className="text-white font-mono">{testState.result.supports_mac_table ? 'Supported' : 'Not detected'}</p>
                                    </div>
                                </div>
                                {Array.isArray(testState.result.notes) && testState.result.notes.length > 0 && (
                                    <div className="mt-3 text-xs text-green-200">
                                        {testState.result.notes.join(' ')}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                <div className="flex flex-col gap-6">
                    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-100 mb-4">Monitoring Preview</h2>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li>Interface status, speed, and error counters</li>
                            <li>MAC address table (when supported)</li>
                            <li>Device uptime, reachability, and sysName</li>
                            <li>Alerts for interface down and bandwidth spikes</li>
                        </ul>
                    </section>

                    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <button
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            className="w-full flex items-center justify-between text-left text-lg font-semibold text-gray-100"
                        >
                            Advanced
                            <ChevronDown className={clsx("w-5 h-5 transition", advancedOpen && "rotate-180")} />
                        </button>
                        {advancedOpen && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">Polling Interval (seconds)</label>
                                    <input
                                        type="number"
                                        value={pollingInterval}
                                        min={10}
                                        onChange={(e) => setPollingInterval(e.target.value)}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Tags (comma separated)</label>
                                    <input
                                        value={tagsInput}
                                        onChange={(e) => setTagsInput(e.target.value)}
                                        className="mt-1 w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white outline-none focus:border-amber-400"
                                        placeholder="core, dc1"
                                    />
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
