import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { subscribeExecution } from '../sse';
import { getWorkflow } from '../api';

const statusColors: Record<string, string> = {
  RUNNING: '#f59e0b',
  SUCCESS: '#10b981',
  FAILED: '#ef4444',
  ENQUEUED: '#6b7280',
  PENDING: '#9ca3af'
};

export default function ExecutionViewer({ workflow, executionId, onClose }: any) {
  const initialNodes = (workflow.workflowJson.nodes || []).map((n: any) => ({
    id: n.id,
    position: n.position || { x: Math.random() * 600, y: Math.random() * 300 },
    data: { ...n.data, label: n.data?.label || n.type, type: n.type },
    style: { background: statusColors.PENDING, color: '#fff', padding: 8 }
  }));
  const initialEdges = (workflow.workflowJson.edges || []).map((e: any) => ({ id: `${e.source}-${e.target}`, source: e.source, target: e.target }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [logs, setLogs] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeExecution(executionId, (ev: any) => {
      const { type, payload, ts } = ev;
      setTimeline((t) => [...t, { type, payload, ts }]);
      setLogs((l) => [...l, `${new Date(ts).toLocaleTimeString()} ${type} ${JSON.stringify(payload)}`]);

      // update node status styles
      if (payload?.nodeId) {
        setNodes((nds: any) => nds.map((node: any) => {
          if (node.id !== payload.nodeId) return node;
          let status = 'PENDING';
          if (type === 'node:start') status = 'RUNNING';
          if (type === 'node:success') status = 'SUCCESS';
          if (type === 'node:failed') status = 'FAILED';
          if (type === 'node:enqueued') status = 'ENQUEUED';
          return { ...node, data: { ...node.data, status }, style: { ...node.style, background: statusColors[status], color: '#fff', padding: 8 } };
        }));
      }
    });
    return unsub;
  }, [executionId, setNodes]);

  return (
    <div className="grid grid-cols-[1fr,320px] gap-4 mt-6">
      <div className="h-[600px] bg-white p-4 rounded shadow">
        <div className="flex justify-between mb-2">
          <div className="font-semibold">Execution: {executionId}</div>
          <div className="flex gap-2">
            <button className="px-2 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
          </div>
        </div>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <div className="bg-white p-4 rounded shadow h-[600px] overflow-auto">
        <div className="font-semibold mb-2">Timeline</div>
        <div className="text-xs text-slate-600 mb-3">Live events from execution</div>
        <div className="space-y-2">
          {timeline.slice().reverse().map((t, i) => (
            <div key={i} className="p-2 border rounded">
              <div className="text-xs text-slate-500">{new Date(t.ts).toLocaleTimeString()}</div>
              <div className="font-medium">{t.type}</div>
              <pre className="text-xs mt-1">{JSON.stringify(t.payload)}</pre>
            </div>
          ))}
        </div>

        <div className="font-semibold mt-4 mb-2">Logs</div>
        <div className="text-xs">
          {logs.slice().reverse().map((l, i) => (<div key={i} className="mb-1">{l}</div>))}
        </div>
      </div>
    </div>
  );
}
