'use client'

import { useMemo, } from 'react'
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { MineInfo, ShapExplanation } from './types'

type NodeData = {
  label: string
  value: string
  source: string
  timestamp: string
  color: string
}

function CustomNode({ data }: NodeProps) {
  const d = data as unknown as NodeData
  return (
    <div
      className="ios-glass-card px-4 py-3 text-center shadow-2xl transition-all"
      style={{ minWidth: 150, borderColor: d.color + '60' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-none" />
      <div className="text-[10px] font-mono uppercase tracking-wider text-[#8FA4B5]">{d.label}</div>
      <div className="mt-1 text-sm font-mono font-bold" style={{ color: d.color }}>{d.value}</div>
      <div className="mt-1 text-[9px] text-[#8FA4B5]">{d.source}</div>
      <div className="text-[8px] text-[#6F7B86]">{d.timestamp}</div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-none" />
    </div>
  )
}

interface Props {
  mine: MineInfo
  shap?: ShapExplanation | null
}

export default function CausalMindMap({ mine, shap }: Props) {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), [])
  const isMP = mine.state === 'MP'

  const initialNodes: Node[] = [
    {
      id: 'rainfall',
      type: 'custom',
      position: { x: 0, y: 120 },
      data: {
        label: 'Precipitation Signal',
        value: isMP ? '118mm / 14d' : '64mm / 14d',
        source: 'ISRO MOSDAC Satellite',
        timestamp: 'Aug 29, 06:00 IST',
        color: '#3B82F6',
      },
    },
    {
      id: 'haul-road',
      type: 'custom',
      position: { x: 260, y: 40 },
      data: {
        label: 'Haul Road Condition',
        value: isMP ? 'Degraded / Saturated' : 'Passable',
        source: 'Sentinel-2 + Field Proxy',
        timestamp: 'Aug 28, 14:30 IST',
        color: isMP ? '#D9584A' : '#3FAE7A',
      },
    },
    {
      id: 'drainage',
      type: 'custom',
      position: { x: 260, y: 220 },
      data: {
        label: 'Pit Sump Drainage',
        value: isMP ? '3 Sump Pumps Active' : 'Nominal Baseline',
        source: 'Field Telemetry',
        timestamp: 'Aug 29, 08:00 IST',
        color: isMP ? '#D99A3A' : '#3FAE7A',
      },
    },
    {
      id: 'cycle-time',
      type: 'custom',
      position: { x: 520, y: 120 },
      data: {
        label: 'Dumper Cycle Time',
        value: isMP ? '+18% Roundtrip' : '+4% Nominal',
        source: 'CMMS Fleet GPS',
        timestamp: 'Aug 29, 09:15 IST',
        color: isMP ? '#D99A3A' : '#3FAE7A',
      },
    },
    {
      id: 'daily-prod',
      type: 'custom',
      position: { x: 780, y: 120 },
      data: {
        label: 'Shortfall Attributed',
        value: isMP ? '-3,155 T / 14-Day' : '-940 T / 14-Day',
        source: 'XGBoost Causal Model',
        timestamp: 'Aug 29, 10:00 IST',
        color: isMP ? '#D9584A' : '#E5C76B',
      },
    },
  ]

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'rainfall', target: 'haul-road', animated: true, style: { stroke: '#3B82F6', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' } },
    { id: 'e2', source: 'rainfall', target: 'drainage', animated: true, style: { stroke: '#3B82F6', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' } },
    { id: 'e3', source: 'haul-road', target: 'cycle-time', animated: true, style: { stroke: isMP ? '#D9584A' : '#3FAE7A', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: isMP ? '#D9584A' : '#3FAE7A' } },
    { id: 'e4', source: 'drainage', target: 'cycle-time', animated: true, style: { stroke: '#D99A3A', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D99A3A' } },
    { id: 'e5', source: 'cycle-time', target: 'daily-prod', animated: true, style: { stroke: isMP ? '#D9584A' : '#E5C76B', strokeWidth: 2.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: isMP ? '#D9584A' : '#E5C76B' } },
  ]

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const waterfall = shap?.waterfall_features || [
    { feature: 'Base Expected Shortfall', shap_value: 15.0, is_base: true },
    { feature: '14-Day Cumulative Rainfall', shap_value: isMP ? 26.4 : 6.2, is_positive: true },
    { feature: 'CMMS Excavator Downtime', shap_value: 16.5, is_positive: true },
    { feature: 'Blasting Block Lag', shap_value: isMP ? 4.0 : 12.8, is_positive: true },
    { feature: 'Stockpile Buffer Below 7d', shap_value: 10.5, is_positive: true },
  ]

  return (
    <div className="ios-glass-card p-6 flex flex-col justify-between gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-copper">
              AI/ML MODULE 05
            </span>
            <span className="text-xs font-mono text-[#8FA4B5]">Additive Driver Attribution & Dependency Graph</span>
          </div>
          <span className="text-xs font-mono text-[#E5C76B]">
            Primary Driver: {shap?.primary_driver || (isMP ? '14-Day Rainfall' : 'Blasting Lag')}
          </span>
        </div>

        <h3 className="text-2xl font-bold text-[#E8F0F2] tracking-tight">
          Causal Mind Map & Explainability
        </h3>
        <p className="text-xs text-[#8FA4B5] mt-1 leading-relaxed">
          Tracing root-cause attribution from orbital precipitation to haul road degradation, dumper cycle delays, and final ore shortfall at {mine.name}.
        </p>
      </div>

      {/* ReactFlow Causal Graph */}
      <div className="rounded-3xl border border-white/10 overflow-hidden h-[340px] bg-[#050607]/90 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background color="rgba(255,255,255,0.03)" gap={20} />
          <Controls
            showInteractive={false}
            style={{
              background: 'rgba(10,16,22,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 16,
            }}
          />
        </ReactFlow>
      </div>

      {/* SHAP Waterfall Feature Attribution */}
      <div className="ios-glass-inset p-4">
        <div className="flex items-center justify-between mb-3 text-xs font-mono">
          <span className="text-[#E8F0F2] uppercase font-bold tracking-wider">
            SHAP Attribution Waterfall (Why AI Predicted Risk)
          </span>
          <span className="text-[#8FA4B5]">Driver Contributions (% of modelled drag)</span>
        </div>

        <div className="space-y-2.5">
          {waterfall.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8FA4B5]">{item.feature}</span>
                <span className={`font-mono font-bold ${item.is_base ? 'text-[#8FA4B5]' : 'text-[#D9584A]'}`}>
                  {item.is_base ? '' : '+'}{item.shap_value}%
                </span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.is_base ? 'bg-white/30' : 'bg-gradient-to-r from-[#E5C76B] to-[#D9584A]'}`}
                  style={{ width: `${Math.min(100, item.shap_value * 2.5)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
