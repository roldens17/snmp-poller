import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, ArrowRight, BellRing, Octagon, RefreshCw, Siren } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { parseAPITimestamp } from '../utils/time';

function SeverityTag({ severity }) {
  const styles = {
    critical: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    info: 'border-slate-600 bg-slate-800 text-slate-300',
  };
  const key = (severity || 'info').toLowerCase();
  return <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', styles[key] || styles.info)}>{key}</span>;
}

export function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  const loadAlerts = async () => {
    setError('');
    if (!lastUpdated) setLoading(true);
    try {
      const data = await api.getAlerts(true);
      setAlerts(data.alerts || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load alerts', err);
      setError('Unable to load incident feed right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    intervalRef.current = setInterval(loadAlerts, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 to-rose-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
              <span className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-2.5">
                <Siren className="h-6 w-6 text-rose-300" />
              </span>
              Active Incident Timeline
            </h1>
            <p className="mt-2 text-sm text-slate-300">Prioritized stream of availability and performance events across tenant infrastructure.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">Pipeline: Active</span>
            {lastUpdated && <span className="text-slate-400">Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>}
            <button onClick={loadAlerts} className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-100 transition hover:bg-slate-700">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error} (click Refresh to retry)</div>}
      {loading && !error && <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-300">Loading alerts...</div>}

      {!loading && !error && alerts.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">No active incidents. Your network is stable right now.</div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <section className="space-y-3">
          {alerts.map((a, idx) => {
            const ts = parseAPITimestamp(a.triggered_at);
            const Icon = a.severity === 'critical' ? Octagon : AlertTriangle;
            return (
              <article
                key={a.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-900/20"
              >
                <div className="absolute left-3 top-0 h-full w-px bg-slate-700" />
                <div className="relative ml-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md border border-slate-600 bg-slate-800 p-1">
                        <Icon className="h-4 w-4 text-rose-300" />
                      </span>
                      <p className="truncate text-sm font-semibold text-white">{a.title || a.alert_type || a.category || 'Alert'}</p>
                      <SeverityTag severity={a.severity} />
                    </div>
                    <p className="text-xs text-slate-400">Device #{a.device_id} • {a.category || 'availability'}</p>
                    <p className="mt-1 text-xs text-slate-500">Triggered {ts ? formatDistanceToNow(ts, { addSuffix: true }) : 'unknown'}</p>
                  </div>

                  <button
                    className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-blue-400 hover:text-blue-300 md:self-auto"
                    onClick={() => a.device_id && navigate(`/devices/${a.device_id}`)}
                    disabled={!a.device_id}
                  >
                    Investigate <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="text-right text-[11px] uppercase tracking-wide text-slate-500">{alerts.length} active incident(s)</div>
      )}
    </div>
  );
}
