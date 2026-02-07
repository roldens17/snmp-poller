import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Background,
    Controls,
    MiniMap
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

// Dagre Layouting Logic
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Larger nodes for switches need more space
    const nodeWidth = 250;
    const nodeHeight = 100;

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

        // Shift slightly to center
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
                position: { x: 0, y: 0 }
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
                    position: { x: 0, y: 0 }
                });

                rawEdges.push({
                    id: `e-${swId}-${m.mac}`,
                    source: `sw-${swId}`,
                    target: nodeId,
                    animated: true,
                    style: { stroke: '#D4AF37', strokeWidth: 1, opacity: 0.5 },
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
                const macsData = await api.getMacs(); // Assuming a simpler all-macs endpoint for now
                setSwitches(devs.devices || []);
                const layouted = buildGraph(devs.devices || [], macsData.mac_entries || []);
                setNodes(layouted.nodes);
                setEdges(layouted.edges);
                setLastUpdated(new Date());

            } catch (e) {
                console.error("Failed to load topology", e);
                setError('Unable to load topology data right now.');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [buildGraph, switchFilter, refreshToken]);

    if (loading) return <div className="flex h-full items-center justify-center text-gold animate-pulse text-xl">Mapping Network...</div>;

    return (
        <div className="h-full flex flex-col fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <span className="w-2 h-6 bg-gold mr-3 rounded-full"></span>
                    Network Map
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-gray-500 bg-black/30 px-3 py-1 rounded border border-white/5">Auto-Layout Active</span>
                    {lastUpdated && (
                        <span className="text-[11px] uppercase tracking-wider text-gray-500">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => setRefreshToken(t => t + 1)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold border border-white/10 transition"
                        title="Refresh topology"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <select
                        value={switchFilter}
                        onChange={(e) => setSwitchFilter(e.target.value)}
                        className="text-xs px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-200 focus:ring-1 focus:ring-gold/50 outline-none"
                    >
                        <option value="all">All switches</option>
                        {switches.map(sw => (
                            <option key={sw.id} value={String(sw.id)}>
                                {sw.hostname || `Switch-${sw.id}`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 glass-panel rounded-xl overflow-hidden shadow-2xl relative border border-gold/10">
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                        <div className="text-red-300 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg text-sm">
                            {error} — try Refresh.
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-rich-black">
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
                        <Background color="#333" gap={24} size={1} />
                        <Controls className="!bg-rich-gray !border-none !fill-gold [&>button]:!border-white/10 [&>button:hover]:!bg-white/10" />
                        <MiniMap
                            nodeStrokeColor={(n) => {
                                if (n.type === 'switch') return '#D4AF37';
                                return '#333';
                            }}
                            nodeColor={(n) => {
                                if (n.type === 'switch') return '#1f2937';
                                return '#D4AF37';
                            }}
                            className="!bg-rich-black/90 !border-gold/20"
                            maskColor="rgba(0, 0, 0, 0.7)"
                        />
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}
