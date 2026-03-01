import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDistanceToNow } from 'date-fns';
import { parseAPITimestamp } from '../utils/time';
import clsx from 'clsx';
import { Activity, Trash2, ArrowLeft, Server } from 'lucide-react';
import { formatHost, getDeviceStatusInfo } from '../utils/deviceStatus';
import { useConfirm } from '../components/ConfirmProvider';
import { useToast } from '../components/ToastProvider';

export function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [macs, setMacs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [activeTab, setActiveTab] = useState('interfaces');
  const { confirm } = useConfirm();
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [d, i, m] = await Promise.all([
          api.getDevice(id),
          api.getDeviceInterfaces(id),
          api.getDeviceMacs(id),
        ]);
        setDevice(d);
        setInterfaces(i.interfaces || []);
        setMacs(m.mac_entries || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleteError('');
    if (!await confirm('Delete this device and all associated data?')) return;
    setDeleting(true);
    try {
      await api.deleteDevice(id);
      toast.success('Device deleted');
      navigate('/switches', { replace: true });
    } catch (err) {
      console.error('Failed to delete device', err);
      setDeleteError('Unable to delete device right now.');
      toast.error('Unable to delete device right now.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Loading device details...
      </div>
    );
  }

  if (!device) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Device not found</div>;
  }

  const statusInfo = getDeviceStatusInfo(device.status, device.last_seen);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
                <Server className="h-6 w-6 text-blue-600" />
                {device.hostname}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{formatHost(device.mgmt_ip)} • {device.site || 'Default'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={clsx('rounded-full border px-3 py-1 text-xs font-semibold uppercase', statusInfo.className)}>{statusInfo.label}</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        {deleteError && <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{deleteError}</div>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200 p-2">
          <button
            onClick={() => setActiveTab('interfaces')}
            className={clsx('rounded-lg px-4 py-2 text-sm font-semibold transition', activeTab === 'interfaces' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            Interfaces ({interfaces.length})
          </button>
          <button
            onClick={() => setActiveTab('macs')}
            className={clsx('rounded-lg px-4 py-2 text-sm font-semibold transition', activeTab === 'macs' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            MAC Table ({macs.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'interfaces' ? (
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Index</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">In Octets</th>
                  <th className="px-4 py-3">Out Octets</th>
                  <th className="px-4 py-3">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interfaces.map((iface) => (
                  <tr key={iface.if_index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{iface.if_index}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{iface.if_name}</div>
                      <div className="text-xs text-slate-500">{iface.if_descr}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                        iface.oper_status?.toLowerCase() === 'up'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      )}>{iface.oper_status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-700">{iface.speed > 0 ? `${iface.speed / 1000000} Mbps` : '-'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{(iface.in_octets || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{(iface.out_octets || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('rounded px-2 py-0.5 text-xs font-mono', ((iface.in_errors || 0) + (iface.out_errors || 0)) > 0 ? 'bg-rose-50 text-rose-700' : 'text-slate-500')}>
                        {(iface.in_errors || 0) + (iface.out_errors || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">VLAN</th>
                  <th className="px-4 py-3">MAC Address</th>
                  <th className="px-4 py-3">Connected Via</th>
                  <th className="px-4 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {macs.length === 0 ? (
                  <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No MAC entries found.</td></tr>
                ) : macs.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600">{m.vlan}</td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-700">{m.mac}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{m.port_name || m.if_index || '-'}</span>
                      {m.port_descr && <div className="mt-1 text-xs text-slate-500">{m.port_descr}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {(() => {
                        const ts = parseAPITimestamp(m.last_seen);
                        return ts ? `${formatDistanceToNow(ts)} ago` : 'never';
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
