const apiBase = import.meta.env.VITE_API_BASE_URL;
if (!apiBase) {
    throw new Error("VITE_API_BASE_URL is not set; configure it to the API origin reachable from the browser.");
}
const API_BASE = apiBase.replace(/\/$/, "");

async function fetchWithTimeout(path, options = {}) {
    const { timeout = 5000, retryOn = [] } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            credentials: 'include',
            signal: controller.signal
        });

        if (!response.ok) {
            if (retryOn.includes(response.status)) {
                // retry once for transient status codes
                return fetchWithTimeout(path, { ...options, retryOn: [], timeout });
            }
            const text = await response.text();
            const err = new Error(`Request failed with status ${response.status}`);
            err.status = response.status;
            err.body = text;
            throw err;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return response.json();
        }
        return response.text();
    } finally {
        clearTimeout(id);
    }
}

function postJson(path, body) {
    return fetchWithTimeout(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export const api = {
    getDevices: (query = '') => fetchWithTimeout(`/devices${query}`, { retryOn: [502, 503, 504] }),
    getDevice: (id) => fetchWithTimeout(`/devices/${id}`),
    getDeviceInterfaces: (id) => fetchWithTimeout(`/devices/${id}/interfaces`),
    getDeviceMacs: (id) => fetchWithTimeout(`/devices/${id}/macs`),
    getMacs: () => fetchWithTimeout(`/macs`, { retryOn: [502, 503, 504] }),
    getAlerts: (active = true) => fetchWithTimeout(`/alerts?active=${active}`),
    getDiscovery: () => fetchWithTimeout(`/discovery`),
    getHealth: () => fetchWithTimeout(`/healthz`),
    login: (email, password) => postJson(`/auth/login`, { email, password }),
    logout: () => postJson(`/auth/logout`, {}),
    me: () => fetchWithTimeout(`/auth/me`),
    getTenants: () => fetchWithTimeout(`/tenants`),
    getActiveTenant: () => fetchWithTimeout(`/tenants/active`),
    setActiveTenant: (tenantId) => postJson(`/tenants/active`, { tenant_id: tenantId }),
};
