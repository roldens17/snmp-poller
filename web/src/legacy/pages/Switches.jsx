import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Search, Server, Plus, RefreshCw, Activity, Radar, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { StatusMessage } from '../components/StatusMessage';
import { formatHost, formatLastSeen, getDeviceStatusInfo } from '../utils/deviceStatus';

function MetricPill({ label, value, tone = 'slate' }) {
  const toneMap = {
    slate: 'border-slate-700 bg-slate-800 text-slate-100',
    blue: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  };
  return (
    <div className={clsx('rounded-xl border px-3 py-2', toneMap[tone])}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

export function Switches() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDevices();
      const list = Array.isArray(data) ? data : data.devices || [];
      setDevices(list);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load switches', err);
      setError('Unable to load switches right now. Check the API URL and try again.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return devices.filter((d) => {
      const hostname = (d.hostname || '').toLowerCase();
      const mgmtIp = d.mgmt_ip || '';
      const site = (d.site || '').toLowerCase();
      return hostname.includes(q) || mgmtIp.includes(search) || site.includes(q);
    });
  }, [devices, search]);

  const stats = useMemo(() => {
    const healthy = devices.filter((d) => getDeviceStatusInfo(d.status, d.last_seen).label === 'Healthy').length;
    const offline = Math.max(0, devices.length - healthy);
    const sites = new Set(devices.map((d) => d.site || 'Default')).size;
    return { healthy, offline, total: devices.length, sites };
  }, [devices]);

  const noDevices = !loading && !error && devices.length === 0;
  const noMatches = !loading && !error && devices.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-5 shadow-xl">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
              <span className="rounded-2xl border border-blue-400/40 bg-blue-500/10 p-2.5">
                <Server className="h-6 w-6 text-blue-300" />
              </span>
              Switch Operations Hub
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Live inventory view for monitored switches with fast status triage and direct drill-in actions.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/devices/new" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add Switch
            </Link>
            <button onClick={loadDevices} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricPill label="Total" value={stats.total} tone="blue" />
          <MetricPill label="Healthy" value={stats.healthy} tone="emerald" />
          <MetricPill label="Offline" value={stats.offline} tone="rose" />
          <MetricPill label="Sites" value={stats.sites} tone="slate" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search hostname, management IP, or site"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
          />
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <StatusMessage variant="loading" title="Loading switches..." />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <StatusMessage variant="error" title={error} onRetry={loadDevices} />
        </div>
      )}

      {!loading && !error && noDevices && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <StatusMessage variant="empty" title="No switches discovered yet." description="They’ll appear here once polling finds devices." />
        </div>
      )}

      {!loading && !error && noMatches && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <StatusMessage variant="empty" title="No switches match your search." />
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((device) => {
            const statusInfo = getDeviceStatusInfo(device.status, device.last_seen);
            const lastSeen = formatLastSeen(device.last_seen);
            return (
              <article key={device.id} className="group overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4 transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-900/30">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{device.hostname}</h3>
                    <p className="mt-0.5 text-xs font-mono text-slate-400">{formatHost(device.mgmt_ip) || '-'}</p>
                  </div>
                  <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusInfo.className)}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="mb-4 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1"><Radar className="h-3.5 w-3.5 text-blue-300" /> Site</span>
                    <span>{device.site || 'Default'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-blue-300" /> Last Seen</span>
                    <span>{lastSeen instanceof Date ? formatDistanceToNow(lastSeen, { addSuffix: true }) : lastSeen}</span>
                  </div>
                </div>

                <Link to={`/devices/${device.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-blue-400 hover:text-blue-300">
                  Manage Device <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </section>
      )}

      <div className="text-right text-[11px] uppercase tracking-wide text-slate-500">
        {lastUpdated ? `Last updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}` : 'Waiting for first load'}
      </div>
    </div>
  );
}
