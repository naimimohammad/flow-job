import { logger } from '../utils/logger';
import { registry } from '../registry';
import { enqueue } from '../queues/queue';
import { Execution } from '../models/Execution';
import { emitEvent } from '../sse';

type Node = any;

export async function runWorkflow(workflowJson: any, executionId: string, mode: 'function' | 'queue' = 'function', initialContext: any = {}) {
  const nodes: Record<string, Node> = {};
  (workflowJson.nodes || []).forEach((n: Node) => (nodes[n.id] = n));
  const edges = workflowJson.edges || [];

  function nextNodes(nodeId: string) {
    return edges.filter((e: any) => e.source === nodeId).map((e: any) => nodes[e.target]);
  }

  const start = Object.values(nodes).find((n: Node) => n.type === 'start');
  if (!start) throw new Error('Start node not found');

  const context = { ...initialContext };

  await Execution.findByIdAndUpdate(executionId, { status: 'RUNNING', startedAt: new Date() });

  async function executeNode(node: Node): Promise<any> {
    logger.info(`Executing node ${node.id} (${node.type})`);
    emitEvent(executionId, 'node:start', { nodeId: node.id, type: node.type });
    if (node.type === 'start') {
      const next = nextNodes(node.id);
      for (const n of next) await executeNode(n);
      return;
    }

    if (node.type === 'task') {
      const jobName = node.data?.job || node.job;
      if (!jobName) throw new Error(`Task node ${node.id} missing job`);
      if (mode === 'queue') {
        await enqueue(jobName, context, { attempts: node.data?.retries || 3 });
        emitEvent(executionId, 'node:enqueued', { nodeId: node.id, job: jobName });
      } else {
        const fn = registry[jobName];
        if (!fn) throw new Error(`Job ${jobName} not registered`);
        await fn(context);
        emitEvent(executionId, 'node:success', { nodeId: node.id, job: jobName });
      }
      const next = nextNodes(node.id);
      for (const n of next) await executeNode(n);
      return;
    }

    if (node.type === 'condition') {
      const expr = node.data?.expression;
      if (!expr) throw new Error(`Condition node ${node.id} missing expression`);
      const fn = new Function('context', `with(context){ return (${expr}); }`);
      const result = fn(context);
      const edgesFrom = edges.filter((e: any) => e.source === node.id);
      // expect first edge to be 'true' path if labeled, else rely on ordering
      let chosen: any = null;
      for (const e of edgesFrom) {
        if (e.condition === 'true' && result) chosen = nodes[e.target];
        if (e.condition === 'false' && !result) chosen = nodes[e.target];
      }
      if (!chosen && edgesFrom.length > 0) chosen = nodes[edgesFrom[0].target];
      if (chosen) await executeNode(chosen);
      if (chosen) emitEvent(executionId, 'node:branch', { nodeId: node.id, chosen: chosen.id });
      return;
    }

    if (node.type === 'delay') {
      const seconds = node.data?.seconds || node.seconds || 1;
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const next = nextNodes(node.id);
      for (const n of next) await executeNode(n);
      return;
    }

    if (node.type === 'parallel') {
      const branches = nextNodes(node.id);
      await Promise.all(branches.map((b) => executeNode(b)));
      // after all branches, continue to next after parallel node
      const after = edges.filter((e: any) => e.source === node.id && e.meta === 'join').map((e:any)=> nodes[e.target]);
      for (const n of after) await executeNode(n);
      emitEvent(executionId, 'node:parallel:complete', { nodeId: node.id });
      return;
    }

    if (node.type === 'end') {
      await Execution.findByIdAndUpdate(executionId, { status: 'SUCCESS', completedAt: new Date() });
      emitEvent(executionId, 'execution:success', { executionId });
      return;
    }

    throw new Error(`Unknown node type ${node.type}`);
  }

  try {
    await executeNode(start);
  } catch (err: any) {
    logger.error('Workflow execution error: ' + err.message);
    await Execution.findByIdAndUpdate(executionId, { status: 'FAILED', completedAt: new Date(), $push: { logs: err.message } });
    emitEvent(executionId, 'execution:failed', { error: err.message });
    throw err;
  }
}
