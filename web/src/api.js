export async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Mock data for development when backend is offline
const MOCK_DEVICES = {
    devices: [
        { id: 1, hostname: 'Core-Switch-01', ip: '10.0.0.1', model: 'Cisco 9300', last_seen: new Date().toISOString() },
        { id: 2, hostname: 'Access-Switch-A', ip: '10.0.1.5', model: 'Cisco 2960', last_seen: new Date().toISOString() },
        { id: 3, hostname: 'Access-Switch-B', ip: '10.0.1.6', model: 'Aruba 2930F', last_seen: new Date().toISOString() }
    ]
};

const MOCK_MACS = {
    mac_entries: [
        { mac: '00:11:22:33:44:55', vlan: 10, device_id: 1, learned_port: 'Gi1/0/1', last_seen: new Date().toISOString() },
        { mac: 'AA:BB:CC:DD:EE:FF', vlan: 20, device_id: 2, learned_port: 'Gi0/4', last_seen: new Date().toISOString() },
        { mac: '11:22:33:44:55:66', vlan: 10, device_id: 2, learned_port: 'Gi0/5', last_seen: new Date().toISOString() },
        { mac: '55:44:33:22:11:00', vlan: 30, device_id: 3, learned_port: '1/1/2', last_seen: new Date().toISOString() }
    ]
};

const MOCK_ALERTS = {
    alerts: [
        { id: 101, category: 'LinkDown', severity: 'critical', device_id: 1, message: 'Uplink interface Gi1/0/24 is down', triggered_at: new Date(Date.now() - 300000).toISOString() },
        { id: 102, category: 'HighCPU', severity: 'warning', device_id: 3, message: 'CPU utilization > 80%', triggered_at: new Date(Date.now() - 3600000).toISOString() }
    ]
};

const fetchMock = async (data, delay = 500) => {
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
};

export const api = {
    getDevices: (query = '') => fetchWithTimeout(`/devices${query}`).catch(() => fetchMock(MOCK_DEVICES)),
    getDevice: (id) => fetchWithTimeout(`/devices/${id}`).catch(() => fetchMock(MOCK_DEVICES.devices[0])),
    getDeviceInterfaces: (id) => fetchWithTimeout(`/devices/${id}/interfaces`).catch(() => fetchMock({ interfaces: [] })),
    getDeviceMacs: (id) => fetchWithTimeout(`/devices/${id}/macs`).catch(() => fetchMock(MOCK_MACS)),
    getMacs: () => fetchWithTimeout(`/macs`).catch(() => fetchMock(MOCK_MACS)),
    getAlerts: (active = true) => fetchWithTimeout(`/alerts?active=${active}`).catch(() => fetchMock(MOCK_ALERTS)),
    getDiscovery: () => fetchWithTimeout(`/discovery`).catch(() => fetchMock({ discovery_status: 'idle' })),
    getHealth: () => fetchWithTimeout(`/healthz`).catch(() => ({ status: 'offline (mocked)' })),
};
