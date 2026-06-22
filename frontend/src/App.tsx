import React, { useState } from 'react';
import WorkflowList from './pages/WorkflowList';
import GraphQLEndpoints from './pages/GraphQLEndpoints';

export default function App() {
  const [tab, setTab] = useState<'workflows' | 'graphql'>('workflows');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Flow Designer</h1>
      <div className="mb-6 flex gap-2">
        <button
          className={`px-4 py-2 rounded ${tab === 'workflows' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          onClick={() => setTab('workflows')}
        >
          Workflows
        </button>
        <button
          className={`px-4 py-2 rounded ${tab === 'graphql' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          onClick={() => setTab('graphql')}
        >
          GraphQL Endpoints
        </button>
      </div>
      {tab === 'workflows' ? <WorkflowList /> : <GraphQLEndpoints />}
    </div>
  );
}
