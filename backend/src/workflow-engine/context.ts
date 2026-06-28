export type SharedContext = Record<string, any> & {
  shared?: Record<string, any>;
  results?: Record<string, any>;
  lastResult?: any;
};

export function createExecutionContext(initialContext: Record<string, any> = {}): SharedContext {
  const context: SharedContext = {
    shared: {},
    results: {},
    ...initialContext
  };

  if (!context.shared || typeof context.shared !== 'object') {
    context.shared = {};
  }
  if (!context.results || typeof context.results !== 'object') {
    context.results = {};
  }

  return context;
}

export function storeTaskResult(context: SharedContext, node: any, result: any) {
  const nodeId = node?.id;
  const jobName = node?.data?.job || node?.job || nodeId;

  context.shared = context.shared || {};
  context.results = context.results || {};
  context.lastResult = result;

  if (nodeId) {
    context.shared[nodeId] = result;
    context.results[nodeId] = result;
  }

  if (jobName && jobName !== nodeId) {
    context.shared[jobName] = result;
    context.results[jobName] = result;
  }

  return context;
}
