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

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    useEffect(() => {
        async function loadData() {
            try {
                const devs = await api.getDevices();
                const macsData = await api.getMacs(); // Assuming a simpler all-macs endpoint for now

                const rawNodes = [];
                const rawEdges = [];

                // Create Switch Nodes
                (devs.devices || []).forEach(d => {
                    rawNodes.push({
                        id: `sw-${d.id}`,
                        type: 'switch',
                        data: { label: d.hostname || `Switch-${d.id}`, ip: d.ip, ports: '24' },
                        position: { x: 0, y: 0 }
                    });
                });

                // Create Device Nodes and Edges
                // Grouping by learned switch to avoid chaos
                const macsBySwitch = {};
                (macsData.mac_entries || []).forEach(m => {
                    if (!m.device_id) return;
                    if (!macsBySwitch[m.device_id]) macsBySwitch[m.device_id] = [];
                    macsBySwitch[m.device_id].push(m);
                });

                Object.keys(macsBySwitch).forEach(swId => {
                    // Limiting to showing only a few devices per switch to keep graph performant
                    macsBySwitch[swId].slice(0, 10).forEach((m, idx) => {
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

                const layouted = getLayoutedElements(rawNodes, rawEdges);
                setNodes(layouted.nodes);
                setEdges(layouted.edges);

            } catch (e) {
                console.error("Failed to load topology", e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) return <div className="flex h-full items-center justify-center text-gold animate-pulse text-xl">Mapping Network...</div>;

    return (
        <div className="h-full flex flex-col fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <span className="w-2 h-6 bg-gold mr-3 rounded-full"></span>
                    Network Map
                </h2>
                <div className="space-x-2">
                    <span className="text-xs text-gray-500 bg-black/30 px-3 py-1 rounded border border-white/5">Auto-Layout Active</span>
                </div>
            </div>

            <div className="flex-1 glass-panel rounded-xl overflow-hidden shadow-2xl relative border border-gold/10">
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
