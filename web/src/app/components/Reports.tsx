import { useState } from 'react';
import { reportsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Download, FileText, FileDown } from 'lucide-react';
import { toast } from 'sonner';

export function Reports() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [sla, setSla] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [slaTarget, setSlaTarget] = useState('99.9');
  const [savingTarget, setSavingTarget] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const [slaRes, incRes] = await Promise.all([
        reportsAPI.getSLA(parseInt(days)),
        reportsAPI.getIncidents(500),
      ]);
      setSla(slaRes?.report || null);
      if (slaRes?.report?.sla_target_percent) setSlaTarget(String(slaRes.report.sla_target_percent));
      setIncidents(incRes?.incidents || []);
      toast.success('SLA report generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }


  async function saveTarget() {
    setSavingTarget(true);
    try {
      await reportsAPI.setSLATarget(Number(slaTarget));
      toast.success('SLA target updated');
      await generate();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  }

  function emailReport() {
    if (!sla) return;
    const subject = encodeURIComponent(`SLA Report (${days}d)`);
    const body = encodeURIComponent(
      `SLA Summary
` +
      `Uptime: ${Number(sla.uptime_percent).toFixed(2)}%
` +
      `Target: ${Number(sla.sla_target_percent || 99.9).toFixed(2)}%
` +
      `Incidents: ${sla.incidents_count}
` +
      `Avg MTTR: ${Number(sla.avg_resolve_minutes).toFixed(1)}m

` +
      `Export links:
` +
      `${window.location.origin}/api/reports/sla.csv
` +
      `${window.location.origin}/api/reports/incidents.csv
`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-midnight-text-primary">Reports</h1>
        <p className="text-midnight-text-secondary mt-1">SLA tracking and client-facing reporting</p>
      </div>

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader><CardTitle>SLA Report (Billable)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-midnight-text-secondary">Window</label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={loading} className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">{loading ? 'Generating...' : 'Generate'}</Button>
            <div className="space-y-2">
              <label className="text-sm text-midnight-text-secondary">SLA Target %</label>
              <div className="flex gap-2">
                <input className="h-10 w-24 rounded-md border border-midnight-border bg-midnight-bg px-2 text-sm" value={slaTarget} onChange={(e)=>setSlaTarget(e.target.value)} />
                <Button variant="outline" onClick={saveTarget} disabled={savingTarget}>{savingTarget ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => reportsAPI.downloadSLAcsv()}><Download className="w-4 h-4 mr-1" />SLA CSV</Button>
              <Button variant="outline" onClick={() => reportsAPI.downloadIncidentsCSV()}><Download className="w-4 h-4 mr-1" />Incidents CSV</Button>
              <Button variant="outline" onClick={() => window.open(`/reports/print?days=${days}`, '_blank')}><FileDown className="w-4 h-4 mr-1" />Print/PDF</Button>
              <Button variant="outline" onClick={emailReport}>Email this report</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {sla && (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader><CardTitle>Tenant SLA Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-midnight-border bg-midnight-bg"><div className="text-xs text-midnight-text-secondary">30d Uptime</div><div className="text-2xl font-bold text-midnight-text-primary">{Number(sla.uptime_percent).toFixed(2)}%</div><div className={`text-xs mt-1 ${sla.sla_breached ? 'text-red-400' : 'text-green-400'}`}>{sla.sla_breached ? `Below target ${Number(sla.sla_target_percent).toFixed(2)}%` : `Meets target ${Number(sla.sla_target_percent).toFixed(2)}%`}</div></div>
              <div className="p-3 rounded border border-midnight-border bg-midnight-bg"><div className="text-xs text-midnight-text-secondary">Incidents</div><div className="text-2xl font-bold text-midnight-text-primary">{sla.incidents_count}</div></div>
              <div className="p-3 rounded border border-midnight-border bg-midnight-bg"><div className="text-xs text-midnight-text-secondary">Avg MTTR</div><div className="text-2xl font-bold text-midnight-text-primary">{Number(sla.avg_resolve_minutes).toFixed(1)}m</div></div>
              <div className="p-3 rounded border border-midnight-border bg-midnight-bg"><div className="text-xs text-midnight-text-secondary">Worst Incident</div><div className="text-2xl font-bold text-midnight-text-primary">{sla.worst_incident_minutes}m</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader><CardTitle>Downtime Incidents</CardTitle></CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-sm text-midnight-text-secondary">No incidents in selected window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-midnight-border"><th className="text-left py-2">Device</th><th className="text-left py-2">IP</th><th className="text-left py-2">Down since</th><th className="text-left py-2">Resolved</th><th className="text-right py-2">Duration (m)</th></tr></thead>
                <tbody>
                  {incidents.map((r: any) => (
                    <tr key={r.alert_id} className="border-b border-midnight-border/40">
                      <td className="py-2">{r.device_name || `Device ${r.device_id}`}</td>
                      <td className="py-2 font-mono text-xs">{r.device_ip || 'n/a'}</td>
                      <td className="py-2">{new Date(r.triggered_at).toLocaleString()}</td>
                      <td className="py-2">{r.resolved_at ? new Date(r.resolved_at).toLocaleString() : 'active'}</td>
                      <td className="py-2 text-right">{r.duration_minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!sla && incidents.length === 0 && (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-midnight-text-secondary mx-auto mb-3" />
            <div className="text-midnight-text-secondary">Generate SLA report to produce client-facing billing evidence.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
