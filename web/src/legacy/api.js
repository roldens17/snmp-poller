const envApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (envApiBase ?? '/api').replace(/\/$/, "");

async function fetchWithTimeout(path, options = {}) {
    const { timeout = 5000, retryOn = [], suppressGlobalError = false } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, {
                ...options,
                credentials: 'include',
                signal: controller.signal
            });
        } catch (networkErr) {
            const err = new Error(networkErr?.message || 'Network request failed');
            err.status = 0;
            err.body = null;
            if (!suppressGlobalError && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:error', {
                    detail: { status: 0, path, message: 'Network error. Please check connectivity.' }
                }));
            }
            throw err;
        }

        if (!response.ok) {
            if (retryOn.includes(response.status)) {
                return fetchWithTimeout(path, { ...options, retryOn: [], timeout });
            }
            const contentType = response.headers.get("content-type") || "";
            let body = null;
            try {
                body = contentType.includes("application/json") ? await response.json() : await response.text();
            } catch {
                body = null;
            }
            const err = new Error(`Request failed with status ${response.status}`);
            err.status = response.status;
            err.body = body;

            if (!suppressGlobalError && response.status >= 500 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:error', {
                    detail: {
                        status: response.status,
                        path,
                        message: (body && body.error) ? body.error : 'Server error. Try again.'
                    }
                }));
            }
            throw err;
        }

        const contentType = response.headers.get("content-type") || "";
        return contentType.includes("application/json") ? response.json() : response.text();
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
    getAPIAlerts: (status = 'active', limit = 50) => fetchWithTimeout(`/api/alerts?status=${status}&limit=${limit}`),
    getTenantOverview: () => fetchWithTimeout(`/api/tenants/overview`),
    getTenantOverviewDetails: (tenantId) => fetchWithTimeout(`/api/tenants/${tenantId}/overview-details`),
    getDiscovery: () => fetchWithTimeout(`/discovery`),
    getHealth: () => fetchWithTimeout(`/healthz`),
    getSystemStatus: () => fetchWithTimeout(`/system/status`, { suppressGlobalError: true }),
    login: (email, password) => postJson(`/auth/login`, { email, password }),
    registerInvite: (token, password, name='') => postJson(`/auth/register-invite`, { token, password, name }),
    logout: () => postJson(`/auth/logout`, {}),
    me: () => fetchWithTimeout(`/auth/me`, { suppressGlobalError: true }),
    getTenants: () => fetchWithTimeout(`/tenants`),
    getActiveTenant: () => fetchWithTimeout(`/tenants/active`),
    setActiveTenant: (tenantId) => postJson(`/tenants/active`, { tenant_id: tenantId }),
    seedDemo: () => postJson(`/demo/seed`, {}),
    resetDemo: () => postJson(`/demo/reset`, {}),
    getBillingPlan: () => fetchWithTimeout(`/billing/plan`),
    updateBillingPlan: (data) => fetchWithTimeout(`/billing/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }),
    getInvites: () => fetchWithTimeout(`/tenants/invites`),
    createInvite: (data) => postJson(`/tenants/invites`, data),
    deleteInvite: (id) => fetchWithTimeout(`/tenants/invites/${id}`, { method: 'DELETE' }),
    getAuditEvents: (limit = 100) => fetchWithTimeout(`/audit/events?limit=${limit}`),
    getAlertDeliveries: (limit = 100) => fetchWithTimeout(`/alerts/deliveries?limit=${limit}`),
    getAlertDestinations: () => fetchWithTimeout(`/alert-destinations`),
    createAlertDestination: (data) => postJson(`/alert-destinations`, data),
    updateAlertDestination: (id, data) => fetchWithTimeout(`/alert-destinations/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    deleteAlertDestination: (id) => fetchWithTimeout(`/alert-destinations/${id}`, { method: 'DELETE' }),
    testSnmp: (data) => fetchWithTimeout(`/api/devices/test-snmp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 20000,
    }),
    createDevice: (data) => postJson(`/api/devices`, data),
    deleteDevice: (id) => fetchWithTimeout(`/devices/${id}`, { method: 'DELETE' }),
};
