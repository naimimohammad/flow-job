import React, { useEffect, useState } from 'react';
import {
  createRequestTask,
  listRequestTasks,
  updateRequestTask,
  deleteRequestTask
} from '../api';

function parseHeaders(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .reduce((acc: Record<string, string>, line) => {
      const [key, ...rest] = line.split(':');
      if (!key) return acc;
      acc[key.trim()] = rest.join(':').trim();
      return acc;
    }, {});
}

function serializeHeaders(headers: any) {
  if (!headers || typeof headers !== 'object') return '';
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

export default function RestRequests() {
  const [requestName, setRequestName] = useState('');
  const [url, setUrl] = useState('https://example.com/api');
  const [method, setMethod] = useState('GET');
  const [headersText, setHeadersText] = useState('Content-Type: application/json');
  const [bodyText, setBodyText] = useState('');
  const [savedTasks, setSavedTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any>(null);

  useEffect(() => {
    async function loadSavedTasks() {
      try {
        const tasks = await listRequestTasks();
        setSavedTasks(tasks);
      } catch (error) {
        console.error('Failed to load REST request tasks', error);
      }
    }
    loadSavedTasks();
  }, []);

  const restTasks = savedTasks.filter((task) => task.requestType === 'rest');

  function resetForm() {
    setRequestName('');
    setUrl('https://example.com/api');
    setMethod('GET');
    setHeadersText('Content-Type: application/json');
    setBodyText('');
    setEditingTask(null);
  }

  async function saveTask() {
    if (!url.trim()) {
      alert('Request URL is required.');
      return;
    }

    const headers = parseHeaders(headersText);
    let parsedBody: any = bodyText;
    if (bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        parsedBody = bodyText;
      }
    }

    try {
      if (editingTask) {
        const updated = await updateRequestTask(editingTask._id, {
          name: requestName || `${method} ${url}`,
          endpoint: url,
          requestType: 'rest',
          httpMethod: method,
          headers,
          body: parsedBody
        });
        setSavedTasks((prev) => prev.map((task) => (task._id === updated._id ? updated : task)));
        resetForm();
        alert('REST request task updated.');
      } else {
        const task = await createRequestTask({
          name: requestName || `${method} ${url}`,
          endpoint: url,
          requestType: 'rest',
          httpMethod: method,
          headers,
          body: parsedBody
        });
        setSavedTasks((prev) => [task, ...(prev || [])]);
        resetForm();
        alert('REST request task created.');
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to save REST request task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this REST request task?')) return;
    try {
      await deleteRequestTask(taskId);
      setSavedTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch (error: any) {
      alert(error?.message || 'Failed to delete REST request task');
    }
  }

  function handleEditTask(task: any) {
    setEditingTask(task);
    setRequestName(task.name || '');
    setUrl(task.endpoint || '');
    setMethod(task.httpMethod || 'GET');
    setHeadersText(serializeHeaders(task.headers));
    if (task.body === undefined || task.body === null) {
      setBodyText('');
    } else if (typeof task.body === 'string') {
      setBodyText(task.body);
    } else {
      setBodyText(JSON.stringify(task.body, null, 2));
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-3">REST Request Builder</h2>
        <p className="text-slate-600 mb-4">Create and save REST request tasks with URL, method, headers, and body.</p>
        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Request Name</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="My REST request"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Request URL</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/v1/items"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">HTTP Method</label>
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Headers</label>
              <textarea
                className="mt-1 w-full h-28 rounded border px-2 py-1 font-mono text-sm"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder="Authorization: Bearer ...\nContent-Type: application/json"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Body</label>
              <textarea
                className="mt-1 w-full h-40 rounded border px-2 py-1 font-mono text-sm"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder='{"key":"value"}'
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={saveTask}>
                {editingTask ? 'Update REST Task' : 'Save REST Task'}
              </button>
              {editingTask && (
                <button className="px-4 py-2 bg-slate-200 rounded" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded border border-slate-200 p-4">
              <div className="font-semibold mb-2">Saved REST Requests</div>
              {restTasks.length === 0 ? (
                <div className="text-slate-500 text-sm">No saved REST request tasks yet.</div>
              ) : (
                <div className="space-y-3">
                  {restTasks.map((task) => (
                    <div key={task._id} className="rounded border border-slate-200 p-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{task.name}</div>
                          <div className="text-slate-500 text-sm truncate">{task.httpMethod} {task.endpoint}</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-2 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => handleEditTask(task)}>
                            Edit
                          </button>
                          <button className="px-2 py-1 bg-red-600 text-white rounded text-sm" onClick={() => handleDeleteTask(task._id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
