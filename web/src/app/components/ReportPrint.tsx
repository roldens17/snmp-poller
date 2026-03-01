import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsAPI, authAPI } from '../lib/api';

export function ReportPrint() {
  const [search] = useSearchParams();
  const days = Number(search.get('days') || '30');
  const [sla, setSla] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [tenantName, setTenantName] = useState('Tenant');

  useEffect(() => {
    (async () => {
      const [slaRes, incRes, session] = await Promise.all([
        reportsAPI.getSLA(days),
        reportsAPI.getIncidents(1000),
        authAPI.getSession(),
      ]);
      setSla(slaRes?.report || null);
      setIncidents(incRes?.incidents || []);
      setTenantName(session?.tenant?.name || 'Tenant');
    })();
  }, [days]);

  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">Monthly Client SLA Report</h1>
          <p className="text-sm text-gray-600">Client: {tenantName}</p>
          <p className="text-sm text-gray-600">Window: Last {days} days</p>
          <p className="text-sm text-gray-600">Generated: {generatedAt}</p>
        </header>

        {sla && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Uptime" value={`${Number(sla.uptime_percent).toFixed(2)}%`} />
            <Kpi label="Incidents" value={`${sla.incidents_count}`} />
            <Kpi label="Avg MTTR" value={`${Number(sla.avg_resolve_minutes).toFixed(1)}m`} />
            <Kpi label="Worst Incident" value={`${sla.worst_incident_minutes}m`} />
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-2">Downtime Incidents</h2>
          {incidents.length === 0 ? (
            <div className="text-sm text-gray-600">No incidents in this window.</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Device</th>
                  <th className="text-left py-2">IP</th>
                  <th className="text-left py-2">Down since</th>
                  <th className="text-left py-2">Resolved</th>
                  <th className="text-right py-2">Duration (m)</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((r: any) => (
                  <tr key={r.alert_id} className="border-b">
                    <td className="py-2">{r.device_name || `Device ${r.device_id}`}</td>
                    <td className="py-2">{r.device_ip || 'n/a'}</td>
                    <td className="py-2">{new Date(r.triggered_at).toLocaleString()}</td>
                    <td className="py-2">{r.resolved_at ? new Date(r.resolved_at).toLocaleString() : 'active'}</td>
                    <td className="py-2 text-right">{r.duration_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="text-xs text-gray-500 pt-4 border-t">
          This report is generated automatically from monitored outage events (DEVICE_DOWN).
        </footer>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
