import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { createWorkflow, updateWorkflow } from '../api';

const defaultLabels: Record<string, string> = {
  start: 'Start',
  end: 'End',
  task: 'Task',
  condition: 'Condition',
  delay: 'Delay',
  parallel: 'Parallel'
};

function createNode(type: string) {
  return {
    id: `${type}-${Date.now()}`,
    position: { x: Math.random() * 600, y: Math.random() * 300 },
    data: {
      label: defaultLabels[type] || type,
      type,
      job: type === 'task' ? 'customTask' : undefined,
      expression: type === 'condition' ? 'context.order?.amount > 1000' : undefined,
      seconds: type === 'delay' ? 5 : undefined
    }
  };
}

export default function Editor({ workflow, onClose }: any) {
  const initialNodes = workflow.workflowJson.nodes?.map((n: any) => ({
    id: n.id,
    position: n.position || { x: Math.random() * 600, y: Math.random() * 300 },
    data: {
      label: n.data?.label || defaultLabels[n.type] || n.type,
      type: n.type,
      job: n.data?.job || n.job,
      expression: n.data?.expression,
      seconds: n.data?.seconds
    }
  })) || [];
  const initialEdges = workflow.workflowJson.edges?.map((e: any) => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label
  })) || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: 'node' | 'edge' } | null>(null);

  const onConnect = useCallback((params: any) => setEdges((eds: any) => addEdge(params, eds)), [setEdges]);
  const onSelectionChange = useCallback((selection: any) => {
    const node = selection.nodes?.[0];
    const edge = selection.edges?.[0];
    if (node) {
      setSelectedElement({ id: node.id, type: 'node' });
    } else if (edge) {
      setSelectedElement({ id: edge.id, type: 'edge' });
    } else {
      setSelectedElement(null);
    }
  }, []);
  const onNodesDelete = useCallback((deleted: any[]) => setNodes((nds: any) => nds.filter((node: any) => !deleted.some((d) => d.id === node.id))), [setNodes]);
  const onEdgesDelete = useCallback((deleted: any[]) => setEdges((eds: any) => eds.filter((edge: any) => !deleted.some((d) => d.id === edge.id))), [setEdges]);
  const deleteSelected = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === 'node') {
      setNodes((nds: any) => nds.filter((node: any) => node.id !== selectedElement.id));
      setEdges((eds: any) => eds.filter((edge: any) => edge.source !== selectedElement.id && edge.target !== selectedElement.id));
    } else {
      setEdges((eds: any) => eds.filter((edge: any) => edge.id !== selectedElement.id));
    }
    setSelectedElement(null);
  }, [selectedElement, setNodes, setEdges]);

  const selectedNode = useMemo(() => {
    if (selectedElement?.type !== 'node') return null;
    return nodes.find((node) => node.id === selectedElement.id);
  }, [nodes, selectedElement]);

  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedElement?.id || selectedElement.type !== 'node') return;
    setNodes((nds: any) => nds.map((node: any) => node.id === selectedElement.id ? { ...node, data: { ...node.data, [key]: value } } : node));
  };

  function addNode(type: string) {
    setNodes((nds: any) => [...nds, createNode(type)]);
  }

  async function handleSave() {
    const hasStart = nodes.some((node: any) => node.data?.type === 'start');
    const hasEnd = nodes.some((node: any) => node.data?.type === 'end');
    if (!hasStart || !hasEnd) {
      alert('Please add both a Start and End node before saving.');
      return;
    }

    const wf = {
      id: workflow.workflowJson.id || workflow._id,
      nodes: nodes.map((n: any) => ({
        id: n.id,
        type: n.data?.type || 'task',
        position: n.position,
        data: {
          label: n.data?.label,
          job: n.data?.job,
          expression: n.data?.expression,
          seconds: n.data?.seconds,
          type: n.data?.type
        }
      })),
      edges: edges.map((e: any) => ({ source: e.source, target: e.target, label: e.label }))
    };

    if (workflow._id) {
      await updateWorkflow(workflow._id, { name: workflow.name || 'workflow', workflowJson: wf });
    } else {
      await createWorkflow({ name: workflow.name || 'workflow', workflowJson: wf });
    }
    onClose();
  }

  return (
    <div className="grid grid-cols-[1fr,280px] gap-4">
      <div className="h-[600px] bg-white p-4 rounded shadow">
        <div className="flex justify-between mb-2">
          <div className="font-semibold">Editor: {workflow.name}</div>
          <div className="flex gap-2">
            <button className="px-2 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={handleSave}>Save</button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {['start', 'end', 'task', 'condition', 'delay', 'parallel'].map((type) => (
            <button key={type} className="px-3 py-1 bg-slate-100 rounded border" onClick={() => addNode(type)}>
              Add {defaultLabels[type]}
            </button>
          ))}
          <button className="px-3 py-1 bg-red-100 text-red-700 rounded border" onClick={deleteSelected} disabled={!selectedElement}>
            Delete Selected
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <div className="bg-white p-4 rounded shadow h-[600px] overflow-auto">
        <div className="font-semibold mb-3">Properties</div>
        {selectedElement ? (
          selectedElement.type === 'node' && selectedNode ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-600">Type</div>
                <div className="font-medium">{selectedNode.data?.type}</div>
              </div>
              <div>
                <label className="block text-sm font-medium">Label</label>
                <input className="mt-1 block w-full rounded border px-2 py-1" value={selectedNode.data?.label || ''} onChange={(e) => handlePropertyChange('label', e.target.value)} />
              </div>
              {selectedNode.data?.type === 'task' && (
                <div>
                  <label className="block text-sm font-medium">Job</label>
                  <input className="mt-1 block w-full rounded border px-2 py-1" value={selectedNode.data?.job || ''} onChange={(e) => handlePropertyChange('job', e.target.value)} />
                </div>
              )}
              {selectedNode.data?.type === 'condition' && (
                <div>
                  <label className="block text-sm font-medium">Expression</label>
                  <textarea className="mt-1 block w-full rounded border px-2 py-1" rows={4} value={selectedNode.data?.expression || ''} onChange={(e) => handlePropertyChange('expression', e.target.value)} />
                </div>
              )}
              {selectedNode.data?.type === 'delay' && (
                <div>
                  <label className="block text-sm font-medium">Seconds</label>
                  <input className="mt-1 block w-full rounded border px-2 py-1" type="number" value={selectedNode.data?.seconds || 1} onChange={(e) => handlePropertyChange('seconds', Number(e.target.value))} />
                </div>
              )}
              <div>
                <div className="text-sm text-slate-600">ID</div>
                <div className="break-all text-xs text-slate-500">{selectedNode.id}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-600">Edge Selected</div>
                <div className="font-medium">{selectedElement.id}</div>
              </div>
              <div className="text-sm text-slate-600">Use the Delete Selected button to remove this edge.</div>
            </div>
          )
        ) : (
          <div className="text-slate-500">Select a node or edge to edit or delete.</div>
        )}
      </div>
    </div>
  );
}
