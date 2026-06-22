import React, { useEffect, useMemo, useState } from 'react';
import { createRequestTask, listRequestTasks } from '../api';

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      types {
        kind
        name
        fields {
          name
          args {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

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
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: introspectionQuery })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map((err: any) => err.message).join('; '));
  }
  return json.data;
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
  const [requestName, setRequestName] = useState('');
  const [variablesJson, setVariablesJson] = useState('{\n  \n}');
  const [savedTasks, setSavedTasks] = useState<any[]>([]);

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
    async function loadSavedTasks() {
      try {
        const tasks = await listRequestTasks();
        setSavedTasks(tasks);
      } catch (error) {
        console.error('Failed to load request tasks', error);
      }
    }
    loadSavedTasks();
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

  async function handleCreateTask() {
    if (!selectedEndpoint || !selectedOperation) return;
    let variables = {};
    try {
      variables = JSON.parse(variablesJson);
    } catch (error) {
      alert('Variables must be valid JSON');
      return;
    }

    const query = buildGraphQLQuery(
      selectedOperation.kind,
      selectedOperation.name,
      selectedOperation.args || [],
      selectedOperation.returnType?.kind || 'OBJECT'
    );

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
      alert('Request task saved');
    } catch (error: any) {
      alert(error?.message || 'Failed to save request task');
    }
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
                          onClick={() => { setSelectedIndex(index); setSelectedOperation({ kind: 'query', name: operation.name, args: operation.args, returnType: operation.returnType }); }}
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
                          onClick={() => { setSelectedIndex(index); setSelectedOperation({ kind: 'mutation', name: operation.name, args: operation.args, returnType: operation.returnType }); }}
                        >
                          {operation.name}{operation.args.length ? `(${operation.args.map((arg:any)=>`${arg.name}: ${arg.type}`).join(', ')})` : ''}
                        </button>
                      )) : <span className="text-sm text-slate-500">No mutation operations</span>}
                    </div>
                  </div>
                </div>
              )}
              <button
                className="mt-3 px-3 py-1 bg-slate-100 rounded text-sm"
                onClick={() => setSelectedIndex(index)}
              >
                Select Endpoint
              </button>
            </div>
          ))}
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
                  <label className="block text-sm font-medium">Variables (JSON)</label>
                  <textarea className="mt-1 w-full h-28 rounded border p-2" value={variablesJson} onChange={(e) => setVariablesJson(e.target.value)} />
                </div>
                <div>
                  <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={handleCreateTask} disabled={!selectedOperation}>Create Request Task</button>
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
                <div className="font-medium">{task.name}</div>
                <div className="text-slate-500 text-sm">{task.operationType}: {task.operation}</div>
                <div className="text-slate-500 text-sm break-all">Endpoint: {task.endpoint}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
