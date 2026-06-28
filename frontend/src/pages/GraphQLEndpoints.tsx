import React, { useEffect, useState } from 'react';
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
import {
  formatGraphQLType,
  GraphQLRequestPanel,
  SelectedOperation
} from '../components/GraphQLBuilder';

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
        type: formatGraphQLType(arg.type),
        typeObj: arg.type
      })),
      returnType: resolveType(field.type)
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

async function introspectGraphQLEndpoint(url: string) {
  return graphqlIntrospect(url);
}

function findOperation(endpoint: any, operationType: 'query' | 'mutation', operationName: string): SelectedOperation | null {
  const list = operationType === 'query' ? endpoint.queryOperations : endpoint.mutationOperations;
  const match = list?.find((op: any) => op.name === operationName);
  if (!match) return null;
  return {
    kind: operationType,
    name: match.name,
    args: match.args || [],
    returnType: match.returnType
  };
}

export default function GraphQLEndpoints() {
  const [endpointInput, setEndpointInput] = useState('https://example.com/graphql');
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<SelectedOperation | null>(null);
  const [savedEndpoints, setSavedEndpoints] = useState<any[]>([]);
  const [requestName, setRequestName] = useState('');
  const [queryText, setQueryText] = useState('');
  const [savedTasks, setSavedTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});

  const selectedEndpoint = selectedIndex !== null ? endpoints[selectedIndex] : null;
  const graphQLTasks = savedTasks.filter((task) => task.requestType === 'graphql' || !task.requestType);

  useEffect(() => {
    async function loadSavedData() {
      try {
        const [tasks, saved] = await Promise.all([listRequestTasks(), listGraphQLEndpoints()]);
        setSavedTasks(tasks);
        setSavedEndpoints(saved);
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

  async function loadEndpoint(url: string) {
    setEndpoints([{ url, status: 'pending', queryOperations: [], mutationOperations: [], error: '' }]);
    try {
      const schema = await introspectGraphQLEndpoint(url);
      const queryTypeName = schema?.__schema?.queryType?.name;
      const mutationTypeName = schema?.__schema?.mutationType?.name;
      const endpoint = {
        url,
        status: 'ready',
        schema,
        queryOperations: getRootTypeFields(schema, queryTypeName),
        mutationOperations: getRootTypeFields(schema, mutationTypeName),
        error: ''
      };
      setEndpoints([endpoint]);
      return endpoint;
    } catch (error: any) {
      const failed = { url, status: 'error', queryOperations: [], mutationOperations: [], error: error.message || 'Failed to fetch schema' };
      setEndpoints([failed]);
      return failed;
    }
  }

  async function handleUseSavedEndpoint(url: string) {
    setEndpointInput(url);
    setSelectedIndex(null);
    setSelectedOperation(null);
    await loadEndpoint(url);
  }

  function selectOperation(index: number, operation: SelectedOperation) {
    setSelectedIndex(index);
    setSelectedOperation(operation);
    setSelectedFields(new Set());
    setVariableValues({});
    setQueryText('');
  }

  async function saveRequestTask() {
    if (!selectedEndpoint) return;

    if (!queryText.trim()) {
      alert('Query text is required.');
      return;
    }

    try {
      const variables = variableValues;

      if (editingTask) {
        const updated = await updateRequestTask(editingTask._id, {
          name: requestName || editingTask.name,
          endpoint: selectedEndpoint.url,
          operationType: editingTask.operationType,
          operation: editingTask.operation,
          query: queryText,
          variables
        });
        setSavedTasks((prev) => prev.map((task) => (task._id === updated._id ? updated : task)));
        setEditingTask(null);
        resetBuilder();
        alert('Request task updated');
      } else {
        if (!selectedOperation) {
          alert('Select an operation');
          return;
        }
        const task = await createRequestTask({
          name: requestName || `${selectedOperation.name} request`,
          endpoint: selectedEndpoint.url,
          operationType: selectedOperation.kind,
          operation: selectedOperation.name,
          query: queryText,
          variables
        });
        setSavedTasks((prev) => [task, ...(prev || [])]);
        resetBuilder();
        alert('Request task saved');
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to save request task');
    }
  }

  function resetBuilder() {
    setRequestName('');
    setVariableValues({});
    setSelectedFields(new Set());
    setQueryText('');
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this request task?')) return;
    try {
      await deleteRequestTask(taskId);
      setSavedTasks((prev) => prev.filter((task) => task._id !== taskId));
      if (editingTask?.id === taskId || editingTask?._id === taskId) {
        setEditingTask(null);
        resetBuilder();
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to delete request task');
    }
  }

  async function handleEditTask(task: any) {
    setEditingTask(task);
    setRequestName(task.name);
    setVariableValues(task.variables || {});
    setQueryText(task.query || '');

    let endpoint = endpoints.find((e) => e.url === task.endpoint);
    if (!endpoint || endpoint.status !== 'ready') {
      endpoint = await loadEndpoint(task.endpoint);
    } else {
      const idx = endpoints.findIndex((e) => e.url === task.endpoint);
      setSelectedIndex(idx >= 0 ? idx : 0);
    }

    if (endpoint.status === 'ready') {
      setSelectedIndex(0);
      const op = findOperation(endpoint, task.operationType, task.operation);
      if (op) setSelectedOperation(op);
    }
  }

  function cancelEdit() {
    setEditingTask(null);
    resetBuilder();
    setSelectedOperation(null);
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
                          onClick={() => selectOperation(index, { kind: 'query', name: operation.name, args: operation.args, returnType: operation.returnType })}
                        >
                          {operation.name}{operation.args.length ? `(${operation.args.map((arg: any) => `${arg.name}: ${arg.type}`).join(', ')})` : ''}
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
                          onClick={() => selectOperation(index, { kind: 'mutation', name: operation.name, args: operation.args, returnType: operation.returnType })}
                        >
                          {operation.name}{operation.args.length ? `(${operation.args.map((arg: any) => `${arg.name}: ${arg.type}`).join(', ')})` : ''}
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

                  {selectedOperation && selectedEndpoint.schema && (
                    <GraphQLRequestPanel
                      schema={selectedEndpoint.schema}
                      operation={selectedOperation}
                      selectedFields={selectedFields}
                      onFieldsChange={setSelectedFields}
                      variableValues={variableValues}
                      onVariableValuesChange={setVariableValues}
                      queryText={queryText}
                      onQueryTextChange={setQueryText}
                      preserveQuery={!!editingTask}
                    />
                  )}

                  {editingTask && !selectedOperation && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Query</label>
                      <textarea
                        className="w-full h-48 rounded border px-3 py-2 font-mono text-sm"
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                      />
                    </div>
                  )}

                  {!selectedOperation && !editingTask && (
                    <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      Pick a query or mutation from the left to open the Postman-style builder
                    </div>
                  )}

                  {(selectedOperation || editingTask) && (
                    <div className="flex flex-wrap gap-2">
                      <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={saveRequestTask}>
                        {editingTask ? 'Save Request Task' : 'Create Request Task'}
                      </button>
                      {editingTask && (
                        <button className="px-4 py-2 bg-slate-200 rounded" onClick={cancelEdit}>Cancel Edit</button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {graphQLTasks.length > 0 && (
        <div className="bg-white p-4 rounded shadow-sm">
          <div className="font-semibold mb-3">Saved GraphQL Request Tasks</div>
          <div className="space-y-3">
            {graphQLTasks.map((task) => (
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
  );
}
