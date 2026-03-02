const envApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (envApiBase ?? '/api').replace(/\/$/, '');

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json();
}

function mapDevice(device: any) {
  return {
    ...device,
    name: device.hostname,
    ipAddress: device.mgmt_ip,
    snmpVersion: device.snmp_version,
    lastPolled: device.last_seen,
    status: device.status === 'active' ? 'up' : device.status,
  };
}

// Auth API
export const authAPI = {
  async signup(email: string, password: string, name: string, tenantName: string) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, tenant_name: tenantName }),
    });
  },

  async login(email: string, password: string) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async getSession() {
    try {
      return await apiRequest('/auth/me');
    } catch {
      return { user: null, tenant: null };
    }
  },
};

// Device API
export const deviceAPI = {
  async list() {
    const data = await apiRequest('/devices');
    return { devices: (data?.devices || []).map(mapDevice) };
  },

  async getById(deviceId: string) {
    const d = await apiRequest(`/devices/${deviceId}`);
    return mapDevice(d);
  },

  async getInterfaces(deviceId: string) {
    const data = await apiRequest(`/devices/${deviceId}/interfaces`);
    return { interfaces: data?.interfaces || [] };
  },

  async getMacs(deviceId: string) {
    const data = await apiRequest(`/devices/${deviceId}/macs`);
    return { mac_entries: data?.mac_entries || [] };
  },

  async create(device: any) {
    const snmp = {
      version: device.snmpVersion || '2c',
      community: device.snmpCommunity || 'public',
    };

    const test = await apiRequest('/api/devices/test-snmp', {
      method: 'POST',
      body: JSON.stringify({
        ip: device.ipAddress,
        snmp,
      }),
    });

    if (!test?.ok || !test?.test_token) {
      throw new Error(test?.message || 'SNMP test failed');
    }

    const created = await apiRequest('/api/devices', {
      method: 'POST',
      body: JSON.stringify({
        device_name: device.name,
        ip_or_hostname: device.ipAddress,
        device_type: 'switch',
        snmp,
        polling_interval_seconds: 60,
        tags: [],
        test_token: test.test_token,
      }),
    });

    return mapDevice(created);
  },

  async update(_deviceId: string, _updates: any) {
    throw new Error('Device update is not available in this backend yet.');
  },

  async delete(deviceId: string) {
    return apiRequest(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  async poll(_deviceId: string) {
    // Per-device poll endpoint is not exposed by the Go backend.
    return apiRequest('/healthz');
  },

  async getMetrics(_deviceId: string, _limit = 100) {
    return { metrics: [] };
  },
};

function mapIncident(alert: any) {
  let parsedDetails: any = null;
  if (typeof alert.details === 'string') {
    try {
      parsedDetails = JSON.parse(alert.details);
    } catch {
      parsedDetails = null;
    }
  } else if (alert.details && typeof alert.details === 'object') {
    parsedDetails = alert.details;
  }

  const summary = parsedDetails?.summary || {};
  const technical = parsedDetails?.details || {};
  const title = summary?.title || alert.title || parsedDetails?.device_name || `Device ${alert.device_id}`;
  const description =
    summary?.message ||
    parsedDetails?.reason ||
    alert.message ||
    alert.details ||
    alert.title ||
    alert.alert_type;

  return {
    id: String(alert.id),
    deviceId: alert.device_id,
    deviceName: title,
    description,
    severity: alert.severity || 'warning',
    status: alert.status === 'active' ? 'open' : 'resolved',
    startTime: alert.triggered_at,
    endTime: alert.resolved_at,
    acknowledgedBy: parsedDetails?.acknowledged_by || '',
    assignedTo: parsedDetails?.assigned_to || '',
    mutedUntil: parsedDetails?.muted_until || '',
    details: parsedDetails || {},
    summary,
    technical,
  };
}

// Incident API
export const incidentAPI = {
  async list(status?: string) {
    const backendStatus = status === 'resolved' ? 'resolved' : 'active';
    const data = await apiRequest(`/api/alerts?status=${backendStatus}&limit=200`);
    let incidents = (data?.alerts || []).map(mapIncident);

    if (!status || status === 'all') {
      const resolvedData = await apiRequest('/api/alerts?status=resolved&limit=200');
      return { incidents: [...incidents, ...((resolvedData?.alerts || []).map(mapIncident))] };
    }

    // Fallback for environments where active alerts are surfaced via overview details.
    if (status === 'open' && incidents.length === 0) {
      try {
        const activeTenant = await apiRequest('/tenants/active');
        const tenantID = activeTenant?.tenant?.id;
        if (tenantID) {
          const overview = await apiRequest(`/api/tenants/${tenantID}/overview-details`);
          incidents = (overview?.active_alerts || []).map((a: any) => ({
            id: String(a.id),
            deviceName: a.device_name || `Device ${a.device_id}`,
            description: a.title || 'Device down alert',
            severity: a.severity || 'warning',
            status: 'open',
            startTime: a.triggered_at,
            endTime: a.resolved_at,
            acknowledgedBy: 'system',
          }));
        }
      } catch {
        // Keep default empty result when fallback fails.
      }
    }

    return { incidents };
  },

  async acknowledge(_incidentId: string) {
    return apiRequest(`/alerts/${_incidentId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async resolve(incidentId: string) {
    return apiRequest(`/alerts/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async assign(incidentId: string, assignee: string) {
    return apiRequest(`/alerts/${incidentId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignee }),
    });
  },

  async mute(incidentId: string, minutes = 60) {
    return apiRequest(`/alerts/${incidentId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    });
  },

  async comment(incidentId: string, comment: string) {
    return apiRequest(`/alerts/${incidentId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  async timeline(incidentId: string, limit = 100) {
    return apiRequest(`/alerts/${incidentId}/timeline?limit=${limit}`);
  },

  async simulateDown(deviceId?: string | number, severity = 'critical') {
    return apiRequest('/alerts/simulate/down', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId ? Number(deviceId) : 0,
        severity,
      }),
    });
  },

  async simulateRecover(deviceId?: string | number) {
    return apiRequest('/alerts/simulate/recover', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId ? Number(deviceId) : 0,
      }),
    });
  },
};

// Webhook API
export const webhookAPI = {
  async list() {
    const [destinationsRes, deliveriesRes] = await Promise.all([
      apiRequest('/alert-destinations'),
      apiRequest('/alerts/deliveries?limit=200'),
    ]);

    const deliveries = deliveriesRes?.deliveries || [];

    const webhooks = (destinationsRes?.destinations || []).map((d: any) => {
      const forDestination = deliveries.filter((x: any) => x.destination_id === d.id);
      const last = forDestination[0];
      return {
        id: d.id,
        name: d.name,
        url: d.url,
        enabled: d.is_enabled,
        events: ['device.down', 'device.up', 'incident.created', 'incident.resolved'],
        createdAt: d.created_at,
        lastTriggered: last?.created_at,
        deliveryCount: forDestination.length,
        lastStatus: last?.status_code,
      };
    });

    return { webhooks };
  },

  async create(webhook: any) {
    return apiRequest('/alert-destinations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'webhook',
        name: webhook.name,
        url: webhook.url,
        is_enabled: webhook.enabled ?? true,
      }),
    });
  },

  async delete(webhookId: string) {
    return apiRequest(`/alert-destinations/${webhookId}`, {
      method: 'DELETE',
    });
  },

  async test(webhookId: string) {
    return apiRequest(`/alert-destinations/${webhookId}/test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};

// Tenant API
export const tenantAPI = {
  async list() {
    return apiRequest('/tenants');
  },

  async get(tenantId: string) {
    const data = await apiRequest('/tenants');
    return { tenant: (data?.tenants || []).find((t: any) => t.id === tenantId) };
  },

  async update(_tenantId: string, _updates: any) {
    throw new Error('Tenant settings update endpoint is not available in this backend.');
  },
};

// Reports API
export const reportsAPI = {
  async getHealthSummary() {
    const [overviewRes, activeTenantRes] = await Promise.all([
      apiRequest('/api/tenants/overview'),
      apiRequest('/tenants/active'),
    ]);

    const active = activeTenantRes?.tenant;
    const row = (overviewRes?.tenants || []).find((t: any) => t.tenant_id === active?.id) || overviewRes?.tenants?.[0];

    const total = row?.total_devices || 0;
    const down = row?.devices_down || 0;
    const up = Math.max(total - down, 0);
    const availability = total > 0 ? ((up / total) * 100).toFixed(1) : '0.0';

    return {
      summary: {
        devices: { total, up, down, availability },
        incidents: { open: row?.active_alerts || 0, total: row?.active_alerts || 0 },
      },
    };
  },

  async getSLA(windowDays = 30) {
    return apiRequest(`/reports/sla?window=${windowDays}d`);
  },

  async getIncidents(limit = 200) {
    return apiRequest(`/reports/incidents?limit=${limit}`);
  },

  async setSLATarget(target: number) {
    return apiRequest(`/reports/sla-target`, {
      method: "PATCH",
      body: JSON.stringify({ target }),
    });
  },

  async getReportRecipients() {
    return apiRequest(`/reports/recipients`);
  },

  async upsertReportRecipient(email: string, frequency = "monthly", enabled = true) {
    return apiRequest(`/reports/recipients`, {
      method: "POST",
      body: JSON.stringify({ email, frequency, enabled }),
    });
  },

  async deleteReportRecipient(id: number) {
    return apiRequest(`/reports/recipients/${id}`, { method: "DELETE" });
  },

  async getReportDeliveryHistory(limit = 50) {
    return apiRequest(`/reports/delivery-history?limit=${limit}`);
  },

  async sendReportNow() {
    return apiRequest(`/reports/send-now`, { method: "POST" });
  },

  async smtpCheck() {
    return apiRequest(`/reports/smtp-check`);
  },

  downloadSLAcsv() {
    window.open(`${API_BASE}/reports/sla.csv`, '_blank');
  },

  downloadIncidentsCSV() {
    window.open(`${API_BASE}/reports/incidents.csv`, '_blank');
  },

  async getUptimeReport(days = 30, _deviceId?: string) {
    const sla = await this.getSLA(days);
    const incidents = await this.getIncidents(500);
    return {
      report: incidents?.incidents || [],
      period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
      generatedAt: new Date().toISOString(),
      sla: sla?.report,
    };
  },
};

// Invite API
export const inviteAPI = {
  async list() {
    return apiRequest('/tenants/invites');
  },

  async create(email: string, role: 'viewer' | 'admin' | 'owner' = 'viewer', expiresInHours = 72) {
    return apiRequest('/tenants/invites', {
      method: 'POST',
      body: JSON.stringify({ email, role, expires_in_hours: expiresInHours }),
    });
  },

  async remove(inviteId: string) {
    return apiRequest(`/tenants/invites/${inviteId}`, {
      method: 'DELETE',
    });
  },
};


export const topologyAPI = {
  async get() {
    return apiRequest('/api/topology');
  },
};
