import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { topologyAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Network, AlertTriangle } from 'lucide-react';

export function Topology() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all'|'up'|'down'>('all');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const data = await topologyAPI.get();
      setNodes(data?.nodes || []);
      setEdges(data?.edges || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    return nodes.filter(n => {
      const matchQ = !query || n.label?.toLowerCase().includes(query.toLowerCase()) || n.ip?.includes(query);
      const matchS = status === 'all' || (status === 'up' ? n.status === 'active' || n.status === 'up' : n.status === 'down' || n.active_alerts > 0);
      return matchQ && matchS;
    });
  }, [nodes, query, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-midnight-text-primary">Topology</h1>
          <p className="text-midnight-text-secondary mt-1">Network map (V1) with device health overlays</p>
        </div>
      </div>

      <Card className="bg-midnight-card border border-midnight-border">
        <CardContent className="pt-6 grid md:grid-cols-3 gap-3">
          <Input placeholder="Search device or IP" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-10 rounded-md border border-midnight-border bg-midnight-bg px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="up">Up only</option>
            <option value="down">Down/alerting</option>
          </select>
          <div className="text-sm text-midnight-text-secondary flex items-center">Nodes: {filtered.length} • Links: {edges.length}</div>
        </CardContent>
      </Card>

      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <CardTitle className="text-midnight-text-primary flex items-center gap-2"><Network className="w-5 h-5" /> Device Graph (list mode)</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-midnight-text-secondary">No topology nodes found.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((n) => (
                <button key={`${n.device_id}`} onClick={() => setSelected(n)} className="p-3 rounded-lg border border-midnight-border bg-midnight-bg text-left hover:border-midnight-accent/40 transition">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-midnight-text-primary truncate">{n.label || `Device ${n.device_id}`}</div>
                    {n.active_alerts > 0 ? <AlertTriangle className="w-4 h-4 text-midnight-status-critical" /> : null}
                  </div>
                  <div className="text-xs text-midnight-text-secondary mt-1">{n.ip || 'n/a'}</div>
                  <div className="text-xs mt-2">
                    <span className={`px-2 py-0.5 rounded border ${n.active_alerts > 0 ? 'border-red-500/30 text-red-400' : 'border-green-500/30 text-green-400'}`}>
                      {n.active_alerts > 0 ? `alerts: ${n.active_alerts}` : 'healthy'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {selected && (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader>
            <CardTitle className="text-midnight-text-primary">Device details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-midnight-text-secondary">Name:</span> <span className="text-midnight-text-primary">{selected.label || `Device ${selected.device_id}`}</span></div>
            <div><span className="text-midnight-text-secondary">IP:</span> <span className="text-midnight-text-primary">{selected.ip || 'n/a'}</span></div>
            <div><span className="text-midnight-text-secondary">Status:</span> <span className="text-midnight-text-primary">{selected.status || 'unknown'}</span></div>
            <div><span className="text-midnight-text-secondary">Active alerts:</span> <span className="text-midnight-text-primary">{selected.active_alerts || 0}</span></div>
            <div className="pt-2 flex gap-2">
              <Link to={`/devices/${selected.device_id}`} className="px-3 py-1.5 rounded-md border border-midnight-border bg-midnight-bg hover:bg-midnight-border text-midnight-text-primary">Open device</Link>
              <button onClick={() => setSelected(null)} className="px-3 py-1.5 rounded-md border border-midnight-border text-midnight-text-secondary hover:text-midnight-text-primary">Close</button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
