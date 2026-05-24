import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
import { reportsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Download, FileText, FileDown, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Reports() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [sla, setSla] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [slaTarget, setSlaTarget] = useState('99.9');
  const [savingTarget, setSavingTarget] = useState(false);

  const [recipients, setRecipients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    generate();
    loadDelivery();
  }, []);

  async function loadDelivery() {
    try {
      const [r, h] = await Promise.all([
        reportsAPI.getReportRecipients(),
        reportsAPI.getReportDeliveryHistory(20),
      ]);
      setRecipients(r?.recipients || []);
      setHistory(h?.history || []);
    } catch {}
  }

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
      `SLA Summary\n` +
      `Uptime: ${Number(sla.uptime_percent).toFixed(2)}%\n` +
      `Target: ${Number(sla.sla_target_percent || 99.9).toFixed(2)}%\n` +
      `Incidents: ${sla.incidents_count}\n` +
      `Avg MTTR: ${Number(sla.avg_resolve_minutes).toFixed(1)}m\n\n` +
      `Export links:\n` +
      `${API_BASE}/reports/sla.csv\n` +
      `${API_BASE}/reports/incidents.csv\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function addRecipient() {
    if (!recipientEmail) return;
    try {
      await reportsAPI.upsertReportRecipient(recipientEmail, 'monthly', true);
      setRecipientEmail('');
      toast.success('Recipient saved');
      await loadDelivery();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save recipient');
    }
  }

  async function removeRecipient(id: number) {
    try {
      await reportsAPI.deleteReportRecipient(id);
      toast.success('Recipient removed');
      await loadDelivery();
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove recipient');
    }
  }

  async function sendNow() {
    try {
      await reportsAPI.sendReportNow();
      toast.success('Report queued for recipients');
      await loadDelivery();
    } catch (e: any) {
      toast.error(e.message || 'Failed to queue report');
    }
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

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader><CardTitle>Report Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <input value={recipientEmail} onChange={(e)=>setRecipientEmail(e.target.value)} placeholder="client@example.com" className="h-10 flex-1 min-w-[220px] rounded-md border border-midnight-border bg-midnight-bg px-3 text-sm" />
            <Button onClick={addRecipient}>Add recipient</Button>
            <Button variant="outline" onClick={sendNow}><Send className="w-4 h-4 mr-1" />Send now</Button>
            <Button variant="outline" onClick={async ()=>{ try{ const r=await reportsAPI.smtpCheck(); if(r?.ok) toast.success('SMTP reachable'); else toast.error(r?.error || 'SMTP check failed'); } catch(e:any){ toast.error(e.message || 'SMTP check failed'); } }}>SMTP check</Button>
          </div>
          <div className="space-y-2">
            {recipients.length === 0 ? <div className="text-sm text-midnight-text-secondary">No recipients configured.</div> : recipients.map((r:any)=>(
              <div key={r.id} className="flex items-center justify-between p-2 rounded border border-midnight-border bg-midnight-bg">
                <div className="text-sm">{r.email}</div>
                <Button variant="outline" size="sm" onClick={()=>removeRecipient(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Recent delivery history</div>
            {history.length === 0 ? <div className="text-sm text-midnight-text-secondary">No deliveries yet.</div> : history.map((h:any)=>(
              <div key={h.id} className="text-xs text-midnight-text-secondary p-2 border border-midnight-border rounded bg-midnight-bg">
                {h.created_at} • {h.recipient_email} • {h.status}
              </div>
            ))}
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
