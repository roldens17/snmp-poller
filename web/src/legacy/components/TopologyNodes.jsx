import { Handle, Position } from 'reactflow';
import { Activity, Box, Smartphone, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function SwitchNode({ data }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-w-[220px] overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-sm"
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-none !bg-blue-500" />

      <div className="flex items-center justify-between border-b border-slate-600 bg-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-blue-400/30 bg-blue-500/10 p-1 text-blue-300">
            <Box className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-100">{data.label}</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300">
          <Globe className="h-3 w-3 text-blue-300" />
          {data.ip || '192.168.1.X'}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Active ports</span>
          <span className="inline-flex items-center gap-1 font-mono text-slate-100">
            <Activity className="h-3 w-3 text-emerald-400" />
            {data.ports || 24}/48
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-none !bg-blue-500" />
    </motion.div>
  );
}

export function DeviceNode({ data }) {
  return (
    <div className="group relative flex flex-col items-center">
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-none !bg-blue-400" />

      <motion.div whileHover={{ scale: 1.15 }} className="relative mt-1 h-4 w-4 rounded-full border border-slate-200/20 bg-gradient-to-br from-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]" />

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 min-w-[120px] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-900 p-2 text-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="mb-1 flex items-center justify-center gap-1">
          <Smartphone className="h-3 w-3 text-blue-300" />
          <span className="text-xs font-semibold text-slate-100">Device</span>
        </div>
        <p className="border-t border-slate-700 pt-1 text-[10px] font-mono text-blue-300">{data.mac}</p>
        <p className="mt-0.5 text-[9px] text-slate-400">VLAN <span className="text-slate-200">{data.vlan}</span></p>
      </div>
    </div>
  );
}
