import { Handle, Position } from 'reactflow';
import { ToggleLeft, Activity, Box, Smartphone, Globe } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function SwitchNode({ data }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="glass-panel-premium min-w-[220px] rounded-xl overflow-hidden group hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] transition duration-300 border border-gold/20"
        >
            {/* Input Handle (Top) */}
            <Handle type="target" position={Position.Top} className="!bg-gold !w-3 !h-3 !border-none shadow-[0_0_10px_#D4AF37]" />

            <div className="bg-gradient-to-r from-gold/15 via-gold/5 to-transparent p-3 border-b border-gold/10 flex items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 animate-shimmer"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-1.5 rounded-lg bg-gold/10 border border-gold/20 mr-2 shadow-[0_0_10px_rgba(212,175,55,0.1)]">
                        <Box className="w-4 h-4 text-gold" />
                    </div>
                    <span className="font-bold text-sm text-gold-light uppercase tracking-wider text-glow">{data.label}</span>
                </div>
                <div className="relative z-10 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/50 shadow-[0_0_8px_#4ade80]"></span>
                </div>
            </div>

            <div className="p-4 bg-rich-black/40 backdrop-blur-sm">
                <div className="flex items-center text-xs text-gray-300 mb-2 font-mono bg-black/30 p-1.5 rounded border border-white/5">
                    <Globe className="w-3 h-3 text-gold/70 mr-2" />
                    {data.ip || '192.168.1.X'}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">Active Ports</span>
                    <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-green-400" />
                        <span className="text-xs font-bold font-mono text-white">{data.ports || 24}/48</span>
                    </div>
                </div>
            </div>

            {/* Output Handles (Bottom) */}
            <Handle type="source" position={Position.Bottom} className="!bg-gold !w-3 !h-3 !border-none shadow-[0_0_10px_#D4AF37]" />
        </motion.div>
    );
}

export function DeviceNode({ data }) {
    return (
        <div className="group relative flex flex-col items-center">
            <Handle type="target" position={Position.Top} className="!bg-gold/50 !w-2 !h-2 !border-none" />

            <motion.div
                whileHover={{ scale: 1.2 }}
                className="cursor-pointer relative mt-1"
            >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gold/30 rounded-full blur-md opacity-30 group-hover:opacity-100 transition duration-300 animate-pulse-glow"></div>

                {/* Node Body */}
                <div className="relative z-10 w-4 h-4 bg-gradient-to-br from-gold to-yellow-600 rounded-full border border-white/20 shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80"></div>
                </div>
            </motion.div>

            {/* Label below node */}
            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-full left-1/2 -translate-x-1/2 pointer-events-none z-50">
                <div className="bg-rich-gray/95 backdrop-blur-md p-2.5 rounded-lg border border-gold/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)] min-w-[120px] text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Smartphone className="w-3 h-3 text-gold" />
                        <span className="text-xs font-bold text-white tracking-wide">Device</span>
                    </div>
                    <p className="text-[10px] font-mono text-gold-light border-t border-gold/10 pt-1">{data.mac}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">VLAN <span className="text-white">{data.vlan}</span></p>
                </div>
            </div>
        </div>
    );
}
