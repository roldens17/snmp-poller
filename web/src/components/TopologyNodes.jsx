import { Handle, Position } from 'reactflow';
import { ToggleLeft, Activity, Box } from 'lucide-react';
import clsx from 'clsx';

export function SwitchNode({ data }) {
    return (
        <div className="glass-panel-gold min-w-[200px] rounded-lg overflow-hidden group hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition duration-300">
            {/* Input Handle (Top) */}
            <Handle type="target" position={Position.Top} className="!bg-gold !w-3 !h-3 !border-none" />

            <div className="bg-gradient-to-r from-gold/20 to-transparent p-3 border-b border-gold/10 flex items-center justify-between">
                <div className="flex items-center">
                    <Box className="w-4 h-4 text-gold mr-2" />
                    <span className="font-bold text-sm text-gold-light uppercase tracking-wider">{data.label}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_5px_#4ade80]"></div>
            </div>

            <div className="p-3 bg-rich-black/50">
                <div className="flex items-center text-xs text-gray-400 mb-1">
                    <span className="font-mono">{data.ip || '192.168.1.X'}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-gray-500 uppercase">Ports Up</span>
                    <span className="text-xs font-mono text-white">{data.ports || 24}/48</span>
                </div>
            </div>

            {/* Output Handles (Bottom) */}
            <Handle type="source" position={Position.Bottom} className="!bg-gold !w-3 !h-3 !border-none" />
        </div>
    );
}

export function DeviceNode({ data }) {
    return (
        <div className="group relative">
            <Handle type="target" position={Position.Top} className="!bg-gold/50 !w-2 !h-2 !border-none" />

            <div className="cursor-pointer">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gold/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition duration-300"></div>

                {/* Node Body */}
                <div className="relative z-10 w-3 h-3 bg-gold rounded-full border border-black shadow-[0_0_10px_rgba(212,175,55,0.5)] group-hover:scale-125 transition duration-300"></div>
            </div>

            {/* Hover Tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-32 bg-rich-back p-2 rounded border border-gold/20 glass-panel opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                <p className="text-xs font-mono text-gold-light text-center">{data.mac}</p>
                <p className="text-[10px] text-gray-500 text-center mt-0.5">VLAN {data.vlan}</p>
            </div>
        </div>
    );
}
