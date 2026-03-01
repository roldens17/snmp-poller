import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { api } from '../api';
import { SwitchNode, DeviceNode } from '../components/TopologyNodes';
import { RefreshCw } from 'lucide-react';

const nodeTypes = {
  switch: SwitchNode,
  device: DeviceNode,
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.type === 'switch' ? 250 : 20, height: node.type === 'switch' ? 120 : 20 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? 'left' : 'top';
    node.sourcePosition = direction === 'LR' ? 'right' : 'bottom';
    node.position = {
      x: nodeWithPosition.x - (node.type === 'switch' ? 125 : 10),
      y: nodeWithPosition.y - (node.type === 'switch' ? 60 : 10),
    };
    return node;
  });

  return { nodes, edges };
};

export function Topology() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [switchFilter, setSwitchFilter] = useState('all');
  const [switches, setSwitches] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const buildGraph = useCallback((devices, macEntries) => {
    const rawNodes = [];
    const rawEdges = [];

    const filteredDevices = switchFilter === 'all'
      ? devices
      : devices.filter(d => String(d.id) === switchFilter);

    filteredDevices.forEach(d => {
      rawNodes.push({
        id: `sw-${d.id}`,
        type: 'switch',
        data: { label: d.hostname || `Switch-${d.id}`, ip: d.ip, ports: '24' },
        position: { x: 0, y: 0 },
      });
    });

    const macsBySwitch = {};
    macEntries.forEach(m => {
      if (!m.device_id) return;
      const key = String(m.device_id);
      if (switchFilter !== 'all' && key !== switchFilter) return;
      if (!macsBySwitch[key]) macsBySwitch[key] = [];
      macsBySwitch[key].push(m);
    });

    Object.keys(macsBySwitch).forEach(swId => {
      macsBySwitch[swId].slice(0, 10).forEach((m) => {
        const nodeId = `dev-${m.mac}`;
        rawNodes.push({
          id: nodeId,
          type: 'device',
          data: { mac: m.mac, vlan: m.vlan },
          position: { x: 0, y: 0 },
        });

        rawEdges.push({
          id: `e-${swId}-${m.mac}`,
          source: `sw-${swId}`,
          target: nodeId,
          animated: true,
          style: { stroke: '#3B82F6', strokeWidth: 1, opacity: 0.5 },
        });
      });
    });

    return getLayoutedElements(rawNodes, rawEdges);
  }, [switchFilter]);

  useEffect(() => {
    async function loadData() {
      setError('');
      setLoading(true);
      try {
        const devs = await api.getDevices();
        const macsData = await api.getMacs();
        setSwitches(devs.devices || []);
        const layouted = buildGraph(devs.devices || [], macsData.mac_entries || []);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Failed to load topology', e);
        setError('Unable to load topology data right now.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [buildGraph, switchFilter, refreshToken]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-300">Mapping network...</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Network Topology</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {lastUpdated && <span className="text-slate-400">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button
            onClick={() => setRefreshToken(t => t + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-100 transition hover:bg-slate-700"
            title="Refresh topology"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <select
            value={switchFilter}
            onChange={(e) => setSwitchFilter(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-slate-100 outline-none"
          >
            <option value="all">All switches</option>
            {switches.map(sw => (
              <option key={sw.id} value={String(sw.id)}>{sw.hostname || `Switch-${sw.id}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70">
            <div className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-sm text-rose-700">{error}</div>
          </div>
        )}
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
          >
            <Background color="#334155" gap={24} size={1} />
            <Controls className="!bg-slate-800 !border-slate-600 !fill-slate-200 [&>button]:!border-slate-600 [&>button:hover]:!bg-slate-700" />
            <MiniMap
              nodeStrokeColor={(n) => (n.type === 'switch' ? '#3B82F6' : '#475569')}
              nodeColor={(n) => (n.type === 'switch' ? '#1e293b' : '#3B82F6')}
              className="!bg-slate-900 !border-slate-700"
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
