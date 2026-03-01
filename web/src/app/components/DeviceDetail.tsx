import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deviceAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<any>(null);
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [macs, setMacs] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [d, i, m] = await Promise.all([
          deviceAPI.getById(id),
          deviceAPI.getInterfaces(id),
          deviceAPI.getMacs(id),
        ]);
        setDevice(d);
        setInterfaces(i.interfaces || []);
        setMacs(m.mac_entries || []);
      } catch (e: any) {
        toast.error(e.message || 'Failed to load device');
      }
    })();
  }, [id]);

  const onDelete = async () => {
    if (!id) return;
    if (!confirm('Delete this device?')) return;
    await deviceAPI.delete(id);
    toast.success('Device deleted');
    navigate('/devices');
  };

  if (!device) return <div className="text-midnight-text-secondary">Loading device...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/devices')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
          <div>
            <h1 className="text-2xl font-bold text-midnight-text-primary">{device.name}</h1>
            <p className="text-midnight-text-secondary">{device.ipAddress}</p>
          </div>
        </div>
        <Button variant="outline" className="text-midnight-status-critical" onClick={onDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
      </div>

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader><CardTitle>Interfaces ({interfaces.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-72 overflow-auto">
            {interfaces.length === 0 ? <div className="text-sm text-midnight-text-secondary">No interface data yet.</div> : interfaces.map((it) => (
              <div key={it.if_index} className="p-2 rounded border border-midnight-border bg-midnight-bg text-sm">
                <div className="font-medium">{it.if_name || `ifIndex ${it.if_index}`}</div>
                <div className="text-xs text-midnight-text-secondary">status: {it.oper_status || 'unknown'}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader><CardTitle>MAC Entries ({macs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-72 overflow-auto">
            {macs.length === 0 ? <div className="text-sm text-midnight-text-secondary">No MAC entries yet.</div> : macs.slice(0,200).map((m, idx) => (
              <div key={`${m.mac}-${idx}`} className="p-2 rounded border border-midnight-border bg-midnight-bg text-xs font-mono">
                {m.mac} {m.vlan ? `vlan:${m.vlan}` : ''}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
