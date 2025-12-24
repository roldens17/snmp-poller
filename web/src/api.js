const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
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



export const api = {
    getDevices: (query = '') => fetchWithTimeout(`${API_BASE}/devices${query}`),
    getDevice: (id) => fetchWithTimeout(`${API_BASE}/devices/${id}`),
    getDeviceInterfaces: (id) => fetchWithTimeout(`${API_BASE}/devices/${id}/interfaces`),
    getDeviceMacs: (id) => fetchWithTimeout(`${API_BASE}/devices/${id}/macs`),
    getMacs: () => fetchWithTimeout(`${API_BASE}/macs`),
    getAlerts: (active = true) => fetchWithTimeout(`${API_BASE}/alerts?active=${active}`),
    getDiscovery: () => fetchWithTimeout(`${API_BASE}/discovery`),
    getHealth: () => fetchWithTimeout(`${API_BASE}/healthz`),
};
