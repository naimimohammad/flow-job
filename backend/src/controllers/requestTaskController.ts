import { Request, Response } from 'express';
import { RequestTask } from '../models/RequestTask';

export async function listRequestTasks(req: Request, res: Response) {
  const tasks = await RequestTask.find().sort({ createdAt: -1 });
  res.json(tasks);
}

export async function getRequestTask(req: Request, res: Response) {
  const task = await RequestTask.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Not found' });
  res.json(task);
}

export async function createRequestTask(req: Request, res: Response) {
  const { name, endpoint, requestType = 'graphql', operationType, operation, query, variables, httpMethod, headers, body } = req.body;
  try {
    if (!name || !endpoint || !requestType) {
      throw new Error('Missing required request task fields');
    }

    if (requestType === 'graphql') {
      if (!operationType || !operation || !query) {
        throw new Error('Missing required GraphQL request task fields');
      }
    }

    if (requestType === 'rest') {
      if (!httpMethod) {
        throw new Error('Missing required REST request task fields');
      }
    }

    const task = await RequestTask.create({
      name,
      endpoint,
      requestType,
      operationType,
      operation,
      query,
      variables,
      httpMethod,
      headers,
      body
    });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateRequestTask(req: Request, res: Response) {
  try {
    const updateFields: any = {};
    if (req.body.name !== undefined) updateFields.name = req.body.name;
    if (req.body.endpoint !== undefined) updateFields.endpoint = req.body.endpoint;
    if (req.body.requestType !== undefined) updateFields.requestType = req.body.requestType;
    if (req.body.operationType !== undefined) updateFields.operationType = req.body.operationType;
    if (req.body.operation !== undefined) updateFields.operation = req.body.operation;
    if (req.body.query !== undefined) updateFields.query = req.body.query;
    if (req.body.variables !== undefined) updateFields.variables = req.body.variables;
    if (req.body.httpMethod !== undefined) updateFields.httpMethod = req.body.httpMethod;
    if (req.body.headers !== undefined) updateFields.headers = req.body.headers;
    if (req.body.body !== undefined) updateFields.body = req.body.body;
    if (req.body.cookieName !== undefined) updateFields.cookieName = req.body.cookieName


    const task = await RequestTask.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    if (!task) return res.status(404).json({ message: 'Not found' });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteRequestTask(req: Request, res: Response) {
  await RequestTask.findByIdAndDelete(req.params.id);
  res.status(204).send();
}
