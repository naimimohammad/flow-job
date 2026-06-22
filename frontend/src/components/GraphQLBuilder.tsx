import React, { useState, useMemo } from 'react';


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
}

export function getTypeFromSchema(schema: any, typeName: string): TypeInfo | null {
  if (!schema?.__schema?.types) return null;
  return schema.__schema.types.find((t: any) => t.name === typeName) || null;
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

export function buildQueryWithSelection(
  operationType: 'query' | 'mutation',
  operationName: string,
  args: Array<{ name: string; type: string }>,
  selectedFields: Set<string>,
  returnTypeName: string,
  schema: any
): string {
  const variableDefinitions = args.length > 0 ? `(${args.map((arg) => `$${arg.name}: ${arg.type}`).join(', ')})` : '';
  const variableAssignments = args.length > 0 ? `(${args.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})` : '';

  let selection = '';
  if (selectedFields.size > 0) {
    const fields = Array.from(selectedFields).join('\n    ');
    selection = `{\n    ${fields}\n  }`;
  } else {
    selection = '{ __typename }';
  }

  return `${operationType} ${operationName}${variableDefinitions} {\n  ${operationName}${variableAssignments} ${selection}\n}`;
}

interface VariableInputProps {
  name: string;
  type: string;
  value: any;
  onChange: (value: any) => void;
  schema?: any;
  depth?: number;
}

function isScalarType(typeName: string): boolean {
  return ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'Time', 'JSON'].includes(typeName);
}

function getComplexTypeFields(schema: any, typeName: string) {
  if (!schema?.types) return [];
  const typeObj = schema.types.find((t: any) => t.name === typeName);
  if (!typeObj?.fields) return [];
  return typeObj.fields.map((field: any) => {
    const { baseType, isRequired } = parseGraphQLType(field.type);
    return {
      name: field.name,
      type: baseType,
      isRequired,
      description: field.description
    };
  });
}

export function VariableInput({ name, type, value, onChange, schema, depth = 0 }: VariableInputProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isArray = type.endsWith('!]') || type.includes('[');
  const isRequired = type.endsWith('!');
  const baseType = type.replace(/[!\[\]]/g, '');

  const scalarType = isScalarType(baseType);
  const complexFields = !scalarType && schema ? getComplexTypeFields(schema, baseType) : [];
  const isComplex = complexFields.length > 0;

  const marginLeft = depth * 16; // 16px per depth level

  if (isArray) {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">{name}: {type}</label>
        <textarea
          className="mt-1 w-full h-20 rounded border px-2 py-1 text-xs"
          value={typeof value === 'string' ? value : JSON.stringify(value || [])}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder="JSON array"
        />
      </div>
    );
  }

  if (baseType === 'Boolean') {
    return (
      <div className="text-sm" style={{ marginLeft: `${marginLeft}px` }}>
        <label className="font-medium text-slate-700">
          {name}: {type}
          {isRequired && <span className="text-red-600"> *</span>}
        </label>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={value ? 'true' : 'false'}
          onChange={(e) => onChange(e.target.value === 'true')}
        >
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
          {name}: {type}
          {isRequired && <span className="text-red-600"> *</span>}
        </label>
        <input
          type={baseType === 'Int' || baseType === 'Float' ? 'number' : 'text'}
          className="mt-1 w-full rounded border px-2 py-1"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isRequired ? 'Required' : 'Optional'}
        />
      </div>
    );
  }

  if (isComplex) {
    const objValue = value || {};
    return (
      <div className="border rounded" style={{ marginLeft: `${marginLeft}px` }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-3 py-2 hover:bg-slate-100 font-medium text-sm flex items-center gap-2"
        >
          <span className="text-xs">{expanded ? '▼' : '▶'}</span>
          {name}: {baseType}
          {isRequired && <span className="text-red-600">*</span>}
        </button>
        {expanded && (
          <div className="bg-slate-50 px-3 py-2 space-y-2 border-t">
            {complexFields.map((field: any) => (
              <VariableInput
                key={field.name}
                name={field.name}
                type={field.type + (field.isRequired ? '!' : '')}
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
      <label className="font-medium text-slate-700">{name}: {type}</label>
      <textarea
        className="mt-1 w-full h-24 rounded border px-2 py-1 text-xs"
        value={typeof value === 'string' ? value : JSON.stringify(value || {})}
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
    <div className="space-y-2">
      {fields.map((field) => (
        <label key={field.name} className="flex items-center gap-2 text-sm cursor-pointer">
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
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">scalar</span>
          ) : (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">object</span>
          )}
        </label>
      ))}
    </div>
  );
}
