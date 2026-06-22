import { Request, Response } from 'express';
import { Workflow } from '../models/Workflow';
import { Execution } from '../models/Execution';
import { runWorkflow } from '../workflow-engine/engine';
import { logger } from '../utils/logger';

function validateWorkflowJson(workflowJson: any) {
  const nodes = workflowJson?.nodes || [];
  const hasStart = nodes.some((node: any) => node.type === 'start');
  const hasEnd = nodes.some((node: any) => node.type === 'end');
  if (!hasStart || !hasEnd) {
    throw new Error('Workflow must include at least one start node and one end node');
  }
}

export async function createWorkflow(req: Request, res: Response) {
  const { name, description, workflowJson } = req.body;
  try {
    validateWorkflowJson(workflowJson);
    const w = await Workflow.create({ name, description, workflowJson });
    res.status(201).json(w);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listWorkflows(req: Request, res: Response) {
  const all = await Workflow.find().sort({ createdAt: -1 });
  res.json(all);
}

export async function getWorkflow(req: Request, res: Response) {
  const w = await Workflow.findById(req.params.id);
  if (!w) return res.status(404).json({ message: 'Not found' });
  res.json(w);
}

export async function updateWorkflow(req: Request, res: Response) {
  try {
    if (req.body.workflowJson) validateWorkflowJson(req.body.workflowJson);
    const updateFields: any = {};
    if (req.body.name !== undefined) updateFields.name = req.body.name;
    if (req.body.description !== undefined) updateFields.description = req.body.description;
    if (req.body.workflowJson !== undefined) updateFields.workflowJson = req.body.workflowJson;
    const w = await Workflow.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    res.json(w);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteWorkflow(req: Request, res: Response) {
  await Workflow.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

export async function executeWorkflow(req: Request, res: Response) {
  const w = await Workflow.findById(req.params.id);
  if (!w) return res.status(404).json({ message: 'Not found' });
  try {
    validateWorkflowJson(w.workflowJson);
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
  const mode = req.body?.mode === 'queue' ? 'queue' : 'function';
  const defaultContext = w.workflowJson?.defaultContext || {};
  const initialContext = { ...defaultContext, ...(req.body?.context || {}) };
  const exec = await Execution.create({ workflowId: w.id, status: 'PENDING', logs: [] });
  // run async
  runWorkflow(w.workflowJson, exec.id, mode, initialContext)
    .then(() => logger.info('Execution finished'))
    .catch((err) => logger.error('Execution error: ' + err.message));

  res.status(202).json({ executionId: exec.id });
}

export async function getExecution(req: Request, res: Response) {
  const e = await Execution.findById(req.params.id);
  if (!e) return res.status(404).json({ message: 'Not found' });
  res.json(e);
}
