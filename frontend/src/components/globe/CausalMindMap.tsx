'use client'

import { useCallback, useMemo, useState } from 'react'
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
      className="liquid-panel px-4 py-3 text-center"
      style={{ minWidth: 140, borderColor: d.color + '40' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-none" />
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8FA4B5]">{d.label}</div>
      <div className="mt-1 text-[14px] font-semibold" style={{ color: d.color }}>{d.value}</div>
      <div className="mt-1 text-[9px] text-[#8FA4B5]">{d.source}</div>
      <div className="text-[8px] text-[#6F7B86]">{d.timestamp}</div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-none" />
    </div>
  )
}

export default function CausalMindMap() {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), [])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const initialNodes: Node[] = [
    {
      id: 'rainfall',
      type: 'custom',
      position: { x: 0, y: 120 },
      data: { label: 'Rainfall', value: '118mm / 14d', source: 'NASA POWER', timestamp: 'Aug 28, 06:00 IST', color: '#3FAE7A' },
    },
    {
      id: 'haul-road',
      type: 'custom',
      position: { x: 280, y: 40 },
      data: { label: 'Haul Road Condition', value: 'Degraded', source: 'Sentinel-2 + field', timestamp: 'Aug 27, 14:30 IST', color: '#D99A3A' },
    },
    {
      id: 'cycle-time',
      type: 'custom',
      position: { x: 280, y: 200 },
      data: { label: 'Cycle Time', value: '+18% avg', source: 'Equipment telemetry', timestamp: 'Aug 28, 08:00 IST', color: '#D99A3A' },
    },
    {
      id: 'drainage',
      type: 'custom',
      position: { x: 280, y: 360 },
      data: { label: 'Drainage Status', value: 'Blocked (3 sites)', source: 'Field inspection', timestamp: 'Aug 27, 16:00 IST', color: '#D9584A' },
    },
    {
      id: 'equipment',
      type: 'custom',
      position: { x: 560, y: 40 },
      data: { label: 'Equipment Downtime', value: '22 hrs / week', source: 'CMMS log', timestamp: 'Aug 28, 07:30 IST', color: '#D99A3A' },
    },
    {
      id: 'daily-prod',
      type: 'custom',
      position: { x: 560, y: 200 },
      data: { label: 'Daily Production', value: '16,800 T', source: 'Dispatch CSV', timestamp: 'Aug 27, 23:59 IST', color: '#E5C76B' },
    },
    {
      id: 'shortfall',
      type: 'custom',
      position: { x: 840, y: 120 },
      data: { label: 'Shortfall Risk', value: '72.4 / 100', source: 'ML model v0.1', timestamp: 'Aug 28, 08:00 IST', color: '#D9584A' },
    },
  ]

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'rainfall', target: 'haul-road', animated: true, style: { stroke: '#3FAE7A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3FAE7A' } },
    { id: 'e2', source: 'rainfall', target: 'drainage', animated: true, style: { stroke: '#3FAE7A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3FAE7A' } },
    { id: 'e3', source: 'haul-road', target: 'cycle-time', animated: true, style: { stroke: '#D99A3A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D99A3A' } },
    { id: 'e4', source: 'drainage', target: 'cycle-time', animated: true, style: { stroke: '#D9584A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D9584A' } },
    { id: 'e5', source: 'equipment', target: 'daily-prod', animated: true, style: { stroke: '#D99A3A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D99A3A' } },
    { id: 'e6', source: 'cycle-time', target: 'daily-prod', animated: true, style: { stroke: '#D99A3A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D99A3A' } },
    { id: 'e7', source: 'daily-prod', target: 'shortfall', animated: true, style: { stroke: '#D9584A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#D9584A' } },
  ]

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.id)
  }, [])

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-[20px] border border-[rgba(186,214,221,0.1)] bg-[rgba(5,6,7,0.6)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="rgba(186,214,221,0.04)" gap={24} />
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(10,16,19,0.85)',
            border: '1px solid rgba(186,214,221,0.14)',
            borderRadius: 12,
          }}
        />
      </ReactFlow>
    </div>
  )
}
