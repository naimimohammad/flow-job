import React, { useEffect, useMemo, useState } from 'react';

interface FieldInfo {
  name: string;
  type: string;
  kind: string;
  isScalar: boolean;
  isList: boolean;
  isRequired: boolean;
}

interface TypeInfo {
  name: string;
  kind: string;
  fields?: Array<{ name: string; type: any }>;
  inputFields?: Array<{ name: string; type: any }>;
  enumValues?: Array<{ name: string }>;
}

export interface OperationArg {
  name: string;
  type: string;
  typeObj?: any;
}

export interface SelectedOperation {
  kind: 'query' | 'mutation';
  name: string;
  args: OperationArg[];
  returnType: { kind: string; name?: string };
}

export function getTypeFromSchema(schema: any, typeName: string): TypeInfo | null {
  if (!schema?.__schema?.types) return null;
  return schema.__schema.types.find((t: any) => t.name === typeName) || null;
}

export function formatGraphQLType(typeObj: any): string {
  if (!typeObj) return 'Unknown';
  if (typeObj.kind === 'NON_NULL') {
    return `${formatGraphQLType(typeObj.ofType)}!`;
  }
  if (typeObj.kind === 'LIST') {
    return `[${formatGraphQLType(typeObj.ofType)}]`;
  }
  return typeObj.name || 'Unknown';
}

export function parseGraphQLType(typeObj: any): { baseType: string; isList: boolean; isRequired: boolean } {
  let current = typeObj;
  let isList = false;
  let isRequired = false;

  while (current) {
    if (current.kind === 'NON_NULL') {
      isRequired = true;
      current = current.ofType;
    } else if (current.kind === 'LIST') {
      isList = true;
      current = current.ofType;
    } else {
      return {
        baseType: current.name || 'Unknown',
        isList,
        isRequired
      };
    }
  }

  return { baseType: 'Unknown', isList, isRequired };
}

export function getFields(schema: any, typeName?: string): FieldInfo[] {
  if (!typeName) return [];
  const type = getTypeFromSchema(schema, typeName);
  if (!type?.fields) return [];

  return type.fields.map((field: any) => {
    const { baseType, isList, isRequired } = parseGraphQLType(field.type);
    const baseTypeObj = getTypeFromSchema(schema, baseType);
    const isScalar = baseTypeObj?.kind === 'SCALAR' || baseTypeObj?.kind === 'ENUM';

    return {
      name: field.name,
      type: baseType,
      kind: baseTypeObj?.kind || 'UNKNOWN',
      isScalar,
      isList,
      isRequired
    };
  });
}

export function buildQueryWithSelection(
  operationType: 'query' | 'mutation',
  operationName: string,
  args: OperationArg[],
  selectedFields: Set<string>,
  returnTypeName: string,
  schema: any
): string {
  const operationLabel = `${operationName}Request`;
  const variableDefinitions = args.length > 0 ? `(${args.map((arg) => `$${arg.name}: ${arg.type}`).join(', ')})` : '';
  const variableAssignments = args.length > 0 ? `(${args.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})` : '';

  let selection = '';
  if (selectedFields.size > 0) {
    const fields = Array.from(selectedFields).join('\n    ');
    selection = `{\n    ${fields}\n  }`;
  } else {
    selection = '{ __typename }';
  }

  return `${operationType} ${operationLabel}${variableDefinitions} {\n  ${operationName}${variableAssignments} ${selection}\n}`;
}

function isScalarTypeName(typeName: string, schema?: any): boolean {
  const builtins = ['String', 'Int', 'Float', 'Boolean', 'ID'];
  if (builtins.includes(typeName)) return true;
  const typeObj = schema ? getTypeFromSchema(schema, typeName) : null;
  return typeObj?.kind === 'SCALAR';
}

function getEnumValues(schema: any, typeName: string): string[] {
  const typeObj = getTypeFromSchema(schema, typeName);
  if (typeObj?.kind !== 'ENUM' || !typeObj.enumValues) return [];
  return typeObj.enumValues.map((v: any) => v.name);
}

function getInputTypeFields(schema: any, typeName: string) {
  const typeObj = getTypeFromSchema(schema, typeName);
  const fields = typeObj?.inputFields || typeObj?.fields || [];
  return fields.map((field: any) => ({
    name: field.name,
    type: formatGraphQLType(field.type),
    typeObj: field.type,
    isRequired: field.type?.kind === 'NON_NULL'
  }));
}

function stripTypeModifiers(type: string) {
  return type.replace(/[!\[\]]/g, '');
}

function coerceVariableValue(raw: any, type: string, schema?: any): any {
  const baseType = stripTypeModifiers(type);
  const isArray = type.includes('[');

  if (raw === '' || raw === undefined || raw === null) return undefined;

  if (isArray) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  if (baseType === 'Int') {
    const n = parseInt(String(raw), 10);
    return Number.isNaN(n) ? raw : n;
  }
  if (baseType === 'Float') {
    const n = parseFloat(String(raw));
    return Number.isNaN(n) ? raw : n;
  }
  if (baseType === 'Boolean') {
    if (typeof raw === 'boolean') return raw;
    return raw === 'true' || raw === true;
  }

  if (typeof raw === 'object') return raw;
  return raw;
}

function buildVariablesObject(args: OperationArg[], values: Record<string, any>, schema?: any) {
  const result: Record<string, any> = {};
  for (const arg of args) {
    const coerced = coerceVariableValue(values[arg.name], arg.type, schema);
    if (coerced !== undefined && coerced !== '') {
      result[arg.name] = coerced;
    }
  }
  return result;
}

function formatVariablesJson(args: OperationArg[], values: Record<string, any>, schema?: any) {
  return JSON.stringify(buildVariablesObject(args, values, schema), null, 2);
}

interface VariableInputProps {
  name: string;
  type: string;
  value: any;
  onChange: (value: any) => void;
  schema?: any;
  depth?: number;
}

export function VariableInput({ name, type, value, onChange, schema, depth = 0 }: VariableInputProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isArray = type.includes('[');
  const isRequired = type.endsWith('!');
  const baseType = stripTypeModifiers(type);

  const enumValues = schema ? getEnumValues(schema, baseType) : [];
  const scalarType = isScalarTypeName(baseType, schema);
  const inputFields = !scalarType && enumValues.length === 0 && schema ? getInputTypeFields(schema, baseType) : [];
  const isComplex = inputFields.length > 0;

  const marginLeft = depth * 16;

  if (isArray) {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">
          {name} <span className="font-mono text-xs text-violet-600">{type}</span>
        </label>
        <textarea
          className="mt-1 w-full h-20 rounded border border-slate-300 px-2 py-1 font-mono text-xs focus:border-blue-500 focus:outline-none"
          value={typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder='["item1", "item2"]'
        />
      </div>
    );
  }

  if (enumValues.length > 0) {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">
          {name} <span className="font-mono text-xs text-violet-600">{type}</span>
          {isRequired && <span className="text-red-600"> *</span>}
        </label>
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{isRequired ? 'Select value…' : 'None'}</option>
          {enumValues.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  if (baseType === 'Boolean') {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">
          {name} <span className="font-mono text-xs text-violet-600">{type}</span>
          {isRequired && <span className="text-red-600"> *</span>}
        </label>
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
          value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          {!isRequired && <option value="">None</option>}
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </div>
    );
  }

  if (scalarType) {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">
          {name} <span className="font-mono text-xs text-violet-600">{type}</span>
          {isRequired && <span className="text-red-600"> *</span>}
        </label>
        <input
          type={baseType === 'Int' || baseType === 'Float' ? 'number' : 'text'}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
          placeholder={isRequired ? 'Required' : 'Optional'}
        />
      </div>
    );
  }

  if (isComplex) {
    const objValue = value || {};
    return (
      <div className="rounded border border-slate-200 bg-white" style={{ marginLeft: `${marginLeft}px` }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-3 py-2 hover:bg-slate-50 font-medium text-sm flex items-center gap-2"
        >
          <span className="text-xs text-slate-400">{expanded ? '▼' : '▶'}</span>
          <span>{name}</span>
          <span className="font-mono text-xs text-violet-600">{baseType}</span>
          {isRequired && <span className="text-red-600">*</span>}
        </button>
        {expanded && (
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
            {inputFields.map((field: any) => (
              <VariableInput
                key={field.name}
                name={field.name}
                type={field.type}
                value={objValue[field.name]}
                onChange={(fieldValue) => onChange({ ...objValue, [field.name]: fieldValue })}
                schema={schema}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
      <label className="font-medium text-slate-700">
        {name} <span className="font-mono text-xs text-violet-600">{type}</span>
      </label>
      <textarea
        className="mt-1 w-full h-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs focus:border-blue-500 focus:outline-none"
        value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        placeholder="JSON object"
      />
    </div>
  );
}

interface FieldSelectorProps {
  schema: any;
  returnTypeName: string;
  selectedFields: Set<string>;
  onFieldsChange: (fields: Set<string>) => void;
}

export function FieldSelector({ schema, returnTypeName, selectedFields, onFieldsChange }: FieldSelectorProps) {
  const fields = useMemo(() => getFields(schema, returnTypeName), [schema, returnTypeName]);

  if (fields.length === 0) {
    return <div className="text-sm text-slate-500">No selectable fields for this type</div>;
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {fields.map((field) => (
        <label key={field.name} className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={selectedFields.has(field.name)}
            onChange={(e) => {
              const newFields = new Set(selectedFields);
              if (e.target.checked) {
                newFields.add(field.name);
              } else {
                newFields.delete(field.name);
              }
              onFieldsChange(newFields);
            }}
            className="rounded border-slate-300"
          />
          <span className="font-mono text-blue-600">{field.name}</span>
          <span className="text-slate-500 text-xs">
            {field.isList ? '[ ]' : ''} {field.type}
            {field.isRequired ? '!' : ''}
          </span>
          {field.isScalar ? (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">scalar</span>
          ) : (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">object</span>
          )}
        </label>
      ))}
    </div>
  );
}

interface GraphQLRequestPanelProps {
  schema: any;
  operation: SelectedOperation;
  selectedFields: Set<string>;
  onFieldsChange: (fields: Set<string>) => void;
  variableValues: Record<string, any>;
  onVariableValuesChange: (values: Record<string, any>) => void;
  queryText: string;
  onQueryTextChange: (query: string) => void;
  preserveQuery?: boolean;
}

export function GraphQLRequestPanel({
  schema,
  operation,
  selectedFields,
  onFieldsChange,
  variableValues,
  onVariableValuesChange,
  queryText,
  onQueryTextChange,
  preserveQuery = false
}: GraphQLRequestPanelProps) {
  const [activeTab, setActiveTab] = useState<'query' | 'variables' | 'selection'>('query');
  const [variablesMode, setVariablesMode] = useState<'form' | 'json'>('form');
  const [variablesJson, setVariablesJson] = useState('{\n\n}');
  const [jsonError, setJsonError] = useState('');

  const generatedQuery = useMemo(() => {
    const returnTypeName = operation.returnType?.name;
    if (!returnTypeName) return '';
    return buildQueryWithSelection(
      operation.kind,
      operation.name,
      operation.args || [],
      selectedFields,
      returnTypeName,
      schema
    );
  }, [operation, selectedFields, schema]);

  const displayQuery = queryText || generatedQuery;

  useEffect(() => {
    setVariablesJson(formatVariablesJson(operation.args || [], variableValues, schema));
    setJsonError('');
  }, [variableValues, operation.args, schema, variablesMode]);

  useEffect(() => {
    if (preserveQuery) return;
    const returnTypeName = operation.returnType?.name;
    if (!returnTypeName) return;
    onQueryTextChange(
      buildQueryWithSelection(
        operation.kind,
        operation.name,
        operation.args || [],
        selectedFields,
        returnTypeName,
        schema
      )
    );
  }, [operation.name, operation.kind, preserveQuery]);

  function handleFieldsChange(fields: Set<string>) {
    onFieldsChange(fields);
    const returnTypeName = operation.returnType?.name;
    if (!returnTypeName) return;
    onQueryTextChange(
      buildQueryWithSelection(
        operation.kind,
        operation.name,
        operation.args || [],
        fields,
        returnTypeName,
        schema
      )
    );
  }

  function applyJsonVariables() {
    try {
      const parsed = JSON.parse(variablesJson || '{}');
      onVariableValuesChange(parsed);
      setJsonError('');
      setVariablesMode('form');
    } catch {
      setJsonError('Invalid JSON');
    }
  }

  function regenerateQuery() {
    onQueryTextChange(generatedQuery);
  }

  const tabClass = (tab: typeof activeTab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-orange-500 text-orange-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
            operation.kind === 'mutation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {operation.kind}
          </span>
          <span className="font-mono font-medium text-slate-800">{operation.name}</span>
        </div>
        {operation.args.length > 0 && (
          <span className="text-xs text-slate-500">
            {operation.args.length} variable{operation.args.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex border-b border-slate-200 bg-white px-2">
        <button type="button" className={tabClass('query')} onClick={() => setActiveTab('query')}>Query</button>
        <button type="button" className={tabClass('variables')} onClick={() => setActiveTab('variables')}>
          Variables
          {operation.args.length > 0 && (
            <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs">{operation.args.length}</span>
          )}
        </button>
        <button type="button" className={tabClass('selection')} onClick={() => setActiveTab('selection')}>Selection</button>
      </div>

      <div className="p-0">
        {activeTab === 'query' && (
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 bg-slate-50">
              <span className="text-xs text-slate-500">GraphQL query</span>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={regenerateQuery}
              >
                Regenerate from schema
              </button>
            </div>
            <textarea
              className="w-full h-56 resize-y border-0 px-4 py-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-200"
              value={displayQuery}
              onChange={(e) => onQueryTextChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {activeTab === 'variables' && (
          <div>
            <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-1.5 bg-slate-50">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium ${variablesMode === 'form' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setVariablesMode('form')}
              >
                Form
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium ${variablesMode === 'json' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => {
                  setVariablesJson(formatVariablesJson(operation.args || [], variableValues, schema));
                  setVariablesMode('json');
                }}
              >
                JSON
              </button>
            </div>

            {operation.args.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                This operation has no variables
              </div>
            ) : variablesMode === 'form' ? (
              <div className="space-y-4 px-4 py-4 max-h-80 overflow-y-auto">
                {operation.args.map((arg) => (
                  <VariableInput
                    key={arg.name}
                    name={arg.name}
                    type={arg.type}
                    value={variableValues[arg.name]}
                    onChange={(value) => onVariableValuesChange({ ...variableValues, [arg.name]: value })}
                    schema={schema}
                  />
                ))}
              </div>
            ) : (
              <div className="p-3">
                <textarea
                  className="w-full h-52 resize-y rounded border border-slate-300 px-3 py-2 font-mono text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-200"
                  value={variablesJson}
                  onChange={(e) => {
                    setVariablesJson(e.target.value);
                    setJsonError('');
                  }}
                  spellCheck={false}
                />
                {jsonError && <div className="mt-1 text-xs text-red-600">{jsonError}</div>}
                <button
                  type="button"
                  className="mt-2 rounded bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
                  onClick={applyJsonVariables}
                >
                  Apply JSON
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'selection' && (
          <div className="px-4 py-4">
            <p className="text-xs text-slate-500 mb-3">
              Choose fields to return from <span className="font-mono">{operation.returnType?.name}</span>
            </p>
            <FieldSelector
              schema={schema}
              returnTypeName={operation.returnType?.name || ''}
              selectedFields={selectedFields}
              onFieldsChange={handleFieldsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
