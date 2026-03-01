import { Calendar, ListChecks, FileText, Briefcase, Download, PieChart, ShieldCheck, Clock3 } from 'lucide-react';

export function Reports() {
  const reports = [
    { title: 'SLA Summary (30 days)', description: 'Client-facing uptime summary with incidents and resolution metrics.', icon: ShieldCheck, cta: 'Export CSV' },
    { title: 'Downtime Incidents', description: 'Incident table with down since, resolved at, and duration for each outage.', icon: Clock3, cta: 'Export CSV' },
    { title: 'Monthly Operations Summary', description: 'High-level metrics and notable events for the selected month.', icon: Calendar, cta: 'Generate' },
    { title: 'Change History', description: 'Detailed log of config changes, device additions, and operational updates.', icon: ListChecks, cta: 'Generate' },
    { title: 'Inventory Export', description: 'Complete export of network assets, grouped by tenant and status.', icon: FileText, cta: 'Export PDF' },
    { title: 'Tenant Health Snapshot', description: 'Per-tenant device down counts, active incidents, and last poll freshness.', icon: Briefcase, cta: 'Generate' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-bold text-slate-900">
            <PieChart className="h-8 w-8 text-blue-600" />
            Reports Center
          </h1>
          <p className="mt-2 text-lg text-slate-600">Generate SLA, billing, and operational reports for customer teams.</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
          Default reporting window: last 30 days
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.title} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <div className="mb-4 inline-flex rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700">
                <r.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{r.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{r.description}</p>
            </div>
            <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Download className="h-4 w-4" />
              {r.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
