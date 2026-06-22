import React from 'react';
import WorkflowList from './pages/WorkflowList';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Flow Designer</h1>
      <WorkflowList />
    </div>
  );
}
