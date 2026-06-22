import React, { useEffect, useState } from 'react';
import { listWorkflows, createWorkflow, executeWorkflow, deleteWorkflow } from '../api';
import { subscribeExecution } from '../sse';
import Editor from './Editor';
import ExecutionViewer from './ExecutionViewer';

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [activeExecution, setActiveExecution] = useState<any | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const w = await listWorkflows();
    setWorkflows(w);
  }

  async function handleCreate() {
    const newW = await createWorkflow({
      name: 'New workflow',
      workflowJson: {
        id: 'workflow',
        nodes: [
          { id: 'start-1', type: 'start', data: { type: 'start', label: 'Start' }, position: { x: 50, y: 100 } },
          { id: 'end-1', type: 'end', data: { type: 'end', label: 'End' }, position: { x: 550, y: 100 } }
        ],
        edges: []
      }
    });
    setEditing(newW);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleCreate}>Create Workflow</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={load}>Refresh</button>
      </div>

      <div className="grid gap-2">
        {workflows.map((w) => (
          <div key={w._id} className="p-3 bg-white rounded shadow-sm flex justify-between">
            <div>{w.name}</div>
            <div className="flex gap-2">
              <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => setEditing(w)}>Edit</button>
              <button className="px-2 py-1 bg-indigo-600 text-white rounded" onClick={async () => {
                const resp = await executeWorkflow(w._id);
                const execId = resp.executionId;
                setActiveExecution({ execId, workflow: w });
              }}>Execute</button>
              <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { await deleteWorkflow(w._id); load(); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editing && <div className="mt-6"><Editor workflow={editing} onClose={() => { setEditing(null); load(); }} /></div>}

      {activeExecution && (
        <div className="mt-6">
          <ExecutionViewer executionId={activeExecution.execId} workflow={activeExecution.workflow} onClose={() => setActiveExecution(null)} />
        </div>
      )}
    </div>
  );
}
