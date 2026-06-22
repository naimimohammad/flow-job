import React, { useEffect, useMemo, useState } from 'react';
import {
  createRequestTask,
  listRequestTasks,
  updateRequestTask,
  deleteRequestTask,
  listGraphQLEndpoints,
  createGraphQLEndpoint,
  deleteGraphQLEndpoint,
  graphqlIntrospect
} from '../api';

function parseEndpoints(input: string) {
  return input
    .split(/[\r\n,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveType(type: any): { kind: string; name?: string } {
  if (!type) return { kind: 'UNKNOWN' };
  if (type.name) return { kind: type.kind, name: type.name };
  return resolveType(type.ofType);
}

function getRootTypeFields(schema: any, typeName?: string) {
  if (!schema || !schema.__schema || !typeName) return [];
  const type = schema.__schema.types.find((t: any) => t.name === typeName);
  if (!type?.fields) return [];
  return type.fields
    .map((field: any) => ({
      name: field.name,
      args: (field.args || []).map((arg: any) => ({
        name: arg.name,
        type: `${resolveType(arg.type).name || 'Unknown'}`
      })),
      returnType: resolveType(field.type)
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

function buildGraphQLQuery(operationType: 'query' | 'mutation', operation: string, args: Array<{ name: string; type: string }>, returnTypeKind: string) {
  const variableDefinitions = args.length > 0 ? `(${args.map((arg) => `$${arg.name}: ${arg.type}`).join(', ')})` : '';
  const variableAssignments = args.length > 0 ? `(${args.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})` : '';
  const needsSelection = !['SCALAR', 'ENUM', 'BOOLEAN', 'INT', 'FLOAT', 'ID'].includes(returnTypeKind);
  const selection = needsSelection ? '{ __typename }' : '';
  const operationName = `${operation}Request`;

  return `${operationType} ${operationName}${variableDefinitions} {\n  ${operation}${variableAssignments}${selection ? ` ${selection}` : ''}\n}`;
}

async function introspectGraphQLEndpoint(url: string) {
  const schema = await graphqlIntrospect(url);
  return schema;
}

export default function GraphQLEndpoints() {
  const [endpointInput, setEndpointInput] = useState('https://example.com/graphql');
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<{
    kind: 'query' | 'mutation';
    name: string;
    args: Array<{ name: string; type: string }>;
    returnType: { kind: string; name?: string };
  } | null>(null);
  const [savedEndpoints, setSavedEndpoints] = useState<any[]>([]);
  const [requestName, setRequestName] = useState('');
  const [variablesJson, setVariablesJson] = useState('{\n  \n}');
  const [queryText, setQueryText] = useState('');
  const [savedTasks, setSavedTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any>(null);

  const selectedEndpoint = selectedIndex !== null ? endpoints[selectedIndex] : null;

  const previewTask = useMemo(() => {
    if (!selectedEndpoint || !selectedOperation) return null;
    let variables = {};
    try {
      variables = JSON.parse(variablesJson);
    } catch {
      variables = {};
    }
    const query = buildGraphQLQuery(selectedOperation.kind, selectedOperation.name, selectedOperation.args || [], selectedOperation.returnType?.kind || 'OBJECT');
    return {
      type: 'graphql_request',
      name: requestName || `${selectedOperation.name} request`,
      endpoint: selectedEndpoint.url,
      operation: selectedOperation.name,
      operationType: selectedOperation.kind,
      query,
      variables
    };
  }, [selectedEndpoint, selectedOperation, requestName, variablesJson]);

  useEffect(() => {
    async function loadSavedData() {
      try {
        const [tasks, endpoints] = await Promise.all([listRequestTasks(), listGraphQLEndpoints()]);
        setSavedTasks(tasks);
        setSavedEndpoints(endpoints);
      } catch (error) {
        console.error('Failed to load saved GraphQL data', error);
      }
    }
    loadSavedData();
  }, []);

  async function handleImport() {
    const urls = parseEndpoints(endpointInput);
    setSelectedIndex(null);
    setSelectedOperation(null);
    setEndpoints(urls.map((url) => ({ url, status: 'pending', queryOperations: [], mutationOperations: [], error: '' })));

    const results = await Promise.all(urls.map(async (url) => {
      try {
        const schema = await introspectGraphQLEndpoint(url);
        const queryTypeName = schema?.__schema?.queryType?.name;
        const mutationTypeName = schema?.__schema?.mutationType?.name;
        const queryOperations = getRootTypeFields(schema, queryTypeName);
        const mutationOperations = getRootTypeFields(schema, mutationTypeName);
        return { url, status: 'ready', schema, queryOperations, mutationOperations, error: '' };
      } catch (error: any) {
        return { url, status: 'error', queryOperations: [], mutationOperations: [], error: error.message || 'Failed to fetch schema' };
      }
    }));

    setEndpoints(results);
  }

  function isEndpointSaved(url: string) {
    return savedEndpoints.some((endpoint) => endpoint.url === url);
  }

  async function saveEndpoint(url: string) {
    if (isEndpointSaved(url)) return;
    try {
      const endpoint = await createGraphQLEndpoint({ url });
      setSavedEndpoints((prev) => [endpoint, ...(prev || [])]);
    } catch (error: any) {
      alert(error?.message || 'Failed to save endpoint');
    }
  }

  async function deleteSavedEndpoint(id: string) {
    if (!confirm('Delete this saved endpoint?')) return;
    try {
      await deleteGraphQLEndpoint(id);
      setSavedEndpoints((prev) => prev.filter((endpoint) => endpoint._id !== id));
    } catch (error: any) {
      alert(error?.message || 'Failed to delete saved endpoint');
    }
  }

  async function handleUseSavedEndpoint(url: string) {
    setEndpointInput(url);
    setSelectedIndex(null);
    setSelectedOperation(null);
    setEndpoints([{ url, status: 'pending', queryOperations: [], mutationOperations: [], error: '' }]);
    try {
      const schema = await introspectGraphQLEndpoint(url);
      const queryTypeName = schema?.__schema?.queryType?.name;
      const mutationTypeName = schema?.__schema?.mutationType?.name;
      const queryOperations = getRootTypeFields(schema, queryTypeName);
      const mutationOperations = getRootTypeFields(schema, mutationTypeName);
      setEndpoints([{ url, status: 'ready', schema, queryOperations, mutationOperations, error: '' }]);
    } catch (error: any) {
      setEndpoints([{ url, status: 'error', queryOperations: [], mutationOperations: [], error: error.message || 'Failed to fetch schema' }]);
    }
  }

  async function saveRequestTask() {
    if (!selectedEndpoint) return;
    let variables = {};
    try {
      variables = JSON.parse(variablesJson);
    } catch (error) {
      alert('Variables must be valid JSON');
      return;
    }

    const query = queryText || (selectedOperation ? buildGraphQLQuery(
      selectedOperation.kind,
      selectedOperation.name,
      selectedOperation.args || [],
      selectedOperation.returnType?.kind || 'OBJECT'
    ) : '');

    if (!query) {
      alert('Query text is required');
      return;
    }

    if (editingTask) {
      try {
        const updated = await updateRequestTask(editingTask._id, {
          name: requestName || editingTask.name,
          endpoint: selectedEndpoint.url,
          operationType: editingTask.operationType,
          operation: editingTask.operation,
          query,
          variables
        });
        setSavedTasks((prev) => prev.map((task) => (task._id === updated._id ? updated : task)));
        setEditingTask(null);
        setRequestName('');
        setVariablesJson('{\n  \n}');
        setQueryText('');
        alert('Request task updated');
      } catch (error: any) {
        alert(error?.message || 'Failed to update request task');
      }
    } else {
      if (!selectedOperation) {
        alert('Select an operation or provide a query');
        return;
      }
      try {
        const task = await createRequestTask({
          name: requestName || `${selectedOperation.name} request`,
          endpoint: selectedEndpoint.url,
          operationType: selectedOperation.kind,
          operation: selectedOperation.name,
          query,
          variables
        });
        setSavedTasks((prev) => [task, ...(prev || [])]);
        setRequestName('');
        setVariablesJson('{\n  \n}');
        setQueryText('');
        alert('Request task saved');
      } catch (error: any) {
        alert(error?.message || 'Failed to save request task');
      }
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this request task?')) return;
    try {
      await deleteRequestTask(taskId);
      setSavedTasks((prev) => prev.filter((task) => task._id !== taskId));
      if (editingTask?.id === taskId || editingTask?._id === taskId) {
        setEditingTask(null);
        setRequestName('');
        setVariablesJson('{\n  \n}');
        setQueryText('');
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to delete request task');
    }
  }

  function handleEditTask(task: any) {
    setEditingTask(task);
    setRequestName(task.name);
    setVariablesJson(JSON.stringify(task.variables || {}, null, 2));
    setQueryText(task.query || '');

    const matchingIndex = endpoints.findIndex((e) => e.url === task.endpoint);
    if (matchingIndex !== -1) {
      setSelectedIndex(matchingIndex);
    } else {
      setEndpoints((prev) => [...prev, { url: task.endpoint, status: 'ready', queryOperations: [], mutationOperations: [], error: '' }]);
      setSelectedIndex(endpoints.length);
    }
  }

  function cancelEdit() {
    setEditingTask(null);
    setRequestName('');
    setVariablesJson('{\n  \n}');
    setQueryText('');
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-3">GraphQL Endpoints</h2>
        <p className="text-slate-600 mb-3">Paste one or more GraphQL endpoint URLs, then import and inspect available queries/mutations.</p>
        <textarea
          className="w-full h-32 rounded border p-2"
          value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleImport}>Import Endpoints</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <div className="space-y-4">
          {endpoints.map((endpoint, index) => (
            <div key={endpoint.url} className="bg-white p-4 rounded shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium break-all">{endpoint.url}</div>
                <div className="text-sm text-slate-500">{endpoint.status === 'ready' ? 'Ready' : endpoint.status === 'pending' ? 'Loading...' : 'Error'}</div>
              </div>
              {endpoint.error && <div className="text-red-600 text-sm mb-2">{endpoint.error}</div>}
              {endpoint.status === 'ready' && (
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-slate-500">Queries</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {endpoint.queryOperations.length ? endpoint.queryOperations.map((operation: any) => (
                        <button
                          key={operation.name}
                          className={`rounded border px-2 py-1 text-sm ${selectedEndpoint === endpoint && selectedOperation?.kind === 'query' && selectedOperation.name === operation.name ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700'}`}
                          onClick={() => {
                            setSelectedIndex(index);
                            setSelectedOperation({ kind: 'query', name: operation.name, args: operation.args, returnType: operation.returnType });
                            setQueryText(buildGraphQLQuery('query', operation.name, operation.args, operation.returnType?.kind || 'OBJECT'));
                          }}
                        >
                          {operation.name}{operation.args.length ? `(${operation.args.map((arg:any)=>`${arg.name}: ${arg.type}`).join(', ')})` : ''}
                        </button>
                      )) : <span className="text-sm text-slate-500">No query operations</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Mutations</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {endpoint.mutationOperations.length ? endpoint.mutationOperations.map((operation: any) => (
                        <button
                          key={operation.name}
                          className={`rounded border px-2 py-1 text-sm ${selectedEndpoint === endpoint && selectedOperation?.kind === 'mutation' && selectedOperation.name === operation.name ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700'}`}
                          onClick={() => {
                            setSelectedIndex(index);
                            setSelectedOperation({ kind: 'mutation', name: operation.name, args: operation.args, returnType: operation.returnType });
                            setQueryText(buildGraphQLQuery('mutation', operation.name, operation.args, operation.returnType?.kind || 'OBJECT'));
                          }}
                        >
                          {operation.name}{operation.args.length ? `(${operation.args.map((arg:any)=>`${arg.name}: ${arg.type}`).join(', ')})` : ''}
                        </button>
                      )) : <span className="text-sm text-slate-500">No mutation operations</span>}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="px-3 py-1 bg-slate-100 rounded text-sm"
                  onClick={() => setSelectedIndex(index)}
                >
                  Select Endpoint
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm ${isEndpointSaved(endpoint.url) ? 'bg-slate-200 text-slate-700 cursor-not-allowed' : 'bg-blue-600 text-white'}`}
                  onClick={() => saveEndpoint(endpoint.url)}
                  disabled={isEndpointSaved(endpoint.url)}
                >
                  {isEndpointSaved(endpoint.url) ? 'Saved' : 'Save Endpoint'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow-sm space-y-4">
            <div className="font-semibold">Saved GraphQL Endpoints</div>
            {savedEndpoints.length === 0 ? (
              <div className="text-slate-500">No saved endpoints yet. Use the Save button on an imported endpoint.</div>
            ) : (
              <div className="space-y-3">
                {savedEndpoints.map((endpoint) => (
                  <div key={endpoint._id} className="rounded border border-slate-200 p-3 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium break-all">{endpoint.url}</div>
                        {endpoint.name && <div className="text-slate-500 text-sm">{endpoint.name}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => handleUseSavedEndpoint(endpoint.url)}>Use</button>
                        <button className="px-2 py-1 bg-red-600 text-white rounded text-sm" onClick={() => deleteSavedEndpoint(endpoint._id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded shadow-sm space-y-4">
            <div className="font-semibold">Request Task Builder</div>
          {!selectedEndpoint ? (
            <div className="text-slate-500">Select an imported endpoint and choose an operation to build a task.</div>
          ) : (
            <>
              <div className="text-sm text-slate-500">Selected endpoint</div>
              <div className="break-all font-medium">{selectedEndpoint.url}</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Request name</label>
                  <input className="mt-1 w-full rounded border px-2 py-1" value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="My GraphQL request" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Query</label>
                  <textarea className="mt-1 w-full h-36 rounded border p-2" value={queryText} onChange={(e) => setQueryText(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium">Variables (JSON)</label>
                  <textarea className="mt-1 w-full h-24 rounded border p-2" value={variablesJson} onChange={(e) => setVariablesJson(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={saveRequestTask}>{editingTask ? 'Save Request Task' : 'Create Request Task'}</button>
                  {editingTask && (
                    <button className="px-4 py-2 bg-slate-200 rounded" onClick={cancelEdit}>Cancel Edit</button>
                  )}
                </div>
              </div>
              {selectedOperation && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm text-slate-500">Selected operation</div>
                  <div className="font-medium">{selectedOperation.kind}: {selectedOperation.name}</div>
                </div>
              )}
              {previewTask && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm text-slate-500 mb-2">Task preview</div>
                  <pre className="text-xs overflow-x-auto">{JSON.stringify(previewTask, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {savedTasks.length > 0 && (
        <div className="bg-white p-4 rounded shadow-sm">
          <div className="font-semibold mb-3">Saved Request Tasks</div>
          <div className="space-y-3">
            {savedTasks.map((task) => (
              <div key={task._id} className="rounded border border-slate-200 p-3 bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{task.name}</div>
                    <div className="text-slate-500 text-sm">{task.operationType}: {task.operation}</div>
                    <div className="text-slate-500 text-sm break-all">Endpoint: {task.endpoint}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => handleEditTask(task)}>Edit</button>
                    <button className="px-2 py-1 bg-red-600 text-white rounded text-sm" onClick={() => handleDeleteTask(task._id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
