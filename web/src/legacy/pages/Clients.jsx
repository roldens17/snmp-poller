import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Search, Smartphone, Router, Cable, Clock3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseAPITimestamp } from '../utils/time';
import clsx from 'clsx';
import { StatusMessage } from '../components/StatusMessage';

function EndpointBadge({ status }) {
  const normalized = (status || '').toLowerCase();
  const tone = normalized === 'up'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : normalized === 'down'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      : 'border-slate-600 bg-slate-800 text-slate-300';
  return <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', tone)}>{status || 'unknown'}</span>;
}

export function Clients() {
  const [macs, setMacs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMacs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMacs();
      setMacs(data.mac_entries || []);
    } catch (e) {
      console.error('Failed to load devices', e);
      setError('Unable to load devices right now. Check the API URL and try again.');
      setMacs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMacs();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return macs.filter((m) => {
      const mac = (m.mac || '').toLowerCase();
      const host = (m.device_hostname || '').toLowerCase();
      const ip = (m.device_mgmt_ip || '').toLowerCase();
      return mac.includes(q) || host.includes(q) || ip.includes(q);
    });
  }, [macs, search]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 to-indigo-950 p-5">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <span className="rounded-2xl border border-blue-400/40 bg-blue-500/10 p-2.5">
            <Smartphone className="h-6 w-6 text-blue-300" />
          </span>
          Endpoint Presence Matrix
        </h1>
        <p className="mt-2 text-sm text-slate-300">Near-real-time MAC and port visibility across monitored switching fabric.</p>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by MAC, hostname, or management IP"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
          />
        </div>
      </section>

      {loading && <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><StatusMessage variant="loading" title="Scanning network..." /></div>}
      {!loading && error && <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><StatusMessage variant="error" title={error} onRetry={loadMacs} /></div>}
      {!loading && !error && filtered.length === 0 && <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><StatusMessage variant="empty" title="No clients found." description="They will appear once polling discovers them." /></div>}

      {!loading && !error && filtered.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m, i) => {
            const ts = parseAPITimestamp(m.last_seen);
            return (
              <article key={`${m.mac}-${i}`} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-900/30">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-blue-300 font-mono">{m.mac}</h3>
                    <p className="truncate text-xs text-slate-400">{m.device_hostname || `Switch #${m.device_id}`}</p>
                  </div>
                  <EndpointBadge status={m.port_oper_status} />
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1"><Router className="h-3.5 w-3.5 text-blue-300" /> Device IP</span>
                    <span className="font-mono">{m.device_mgmt_ip || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1"><Cable className="h-3.5 w-3.5 text-blue-300" /> Port</span>
                    <span className="font-mono">{m.port_name || m.if_index || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-blue-300" /> Last Seen</span>
                    <span>{ts ? formatDistanceToNow(ts, { addSuffix: true }) : 'never'}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>VLAN {m.vlan ?? '-'}</span>
                  <span>{m.port_descr || 'No description'}</span>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="text-right text-[11px] uppercase tracking-wide text-slate-500">Total endpoints: {filtered.length}</div>
    </div>
  );
}
