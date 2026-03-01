import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, Activity, Server, TrendingUp } from 'lucide-react';
import { getDeviceStatusInfo } from '../utils/deviceStatus';

function StatCard({ title, value, subtitle, icon: Icon, accent = 'text-slate-700' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className={"text-5xl font-bold leading-none " + accent}>{value}</p>
      <p className="mt-3 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

export function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const loadData = async () => {
    try {
      const [devRes, alertRes] = await Promise.all([
        api.getDevices().catch(() => ({ devices: [] })),
        api.getAPIAlerts('active', 20).catch(() => ({ alerts: [] })),
      ]);
      setDevices(devRes.devices || []);
      setAlerts(alertRes.alerts || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      setPolling(false);
    }
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    const up = devices.filter((d) => getDeviceStatusInfo(d.status, d.last_seen).label === 'Healthy').length;
    const down = Math.max(0, devices.length - up);
    const availability = devices.length ? (up / devices.length) * 100 : 0;
    return {
      total: devices.length,
      up,
      down,
      availability,
      openIncidents: alerts.length,
    };
  }, [devices, alerts]);

  const healthLabel = summary.availability >= 95 ? 'Excellent' : summary.availability >= 80 ? 'Good' : 'Poor';
  const healthColor = summary.availability >= 95 ? 'text-emerald-600' : summary.availability >= 80 ? 'text-amber-600' : 'text-red-600';

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-xl text-slate-600">Network health overview</p>
        </div>
        <button
          onClick={() => { setPolling(true); loadData(); }}
          disabled={polling}
          className="rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {polling ? 'Polling...' : 'Poll All Devices'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Devices"
          value={summary.total}
          subtitle={`${summary.up} up, ${summary.down} down`}
          icon={Server}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Availability</p>
            <Activity className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-5xl font-bold leading-none text-slate-900">{summary.availability.toFixed(1)}%</p>
          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-500" style={{ width: `${summary.availability}%` }} />
          </div>
        </div>
        <StatCard
          title="Open Incidents"
          value={summary.openIncidents}
          subtitle={`${summary.openIncidents} total incidents`}
          icon={AlertTriangle}
          accent={summary.openIncidents > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        <StatCard
          title="Network Health"
          value={healthLabel}
          subtitle="Overall network status"
          icon={TrendingUp}
          accent={healthColor}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900">Open Incidents</h2>
          {alerts.length === 0 ? (
            <p className="py-6 text-slate-500">No open incidents</p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 5).map((incident) => {
                const severity = (incident.severity || 'warning').toLowerCase();
                const severityClass = severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200';
                return (
                  <div key={incident.id} className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{incident.title || incident.alert_type || 'Incident'}</span>
                      <span className={'rounded-full border px-2 py-0.5 text-xs font-semibold ' + severityClass}>{severity}</span>
                    </div>
                    <p className="text-sm text-slate-600">Device #{incident.device_id} is reporting issues.</p>
                  </div>
                );
              })}
              {alerts.length > 5 && (
                <Link to="/alerts" className="block pt-1 text-center text-sm font-medium text-blue-600 hover:text-blue-700">View all {alerts.length} incidents →</Link>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900">Device Status</h2>
          {devices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-3 text-slate-500">No devices configured</p>
              <Link to="/devices/new" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add Your First Device</Link>
            </div>
          ) : (
            <div className="max-h-[460px] space-y-2 overflow-y-auto">
              {devices.map((device) => {
                const status = getDeviceStatusInfo(device.status, device.last_seen).label.toLowerCase();
                const dotClass = status === 'healthy' ? 'bg-green-500' : 'bg-red-500';
                const pillClass = status === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
                return (
                  <div key={device.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={'h-3 w-3 rounded-full ' + dotClass} />
                      <div>
                        <div className="font-semibold text-slate-900">{device.hostname || `Device #${device.id}`}</div>
                        <div className="text-xs text-slate-500">{device.mgmt_ip || '-'}</div>
                      </div>
                    </div>
                    <span className={'rounded-full px-2.5 py-1 text-xs font-semibold uppercase ' + pillClass}>{status === 'healthy' ? 'up' : 'down'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
