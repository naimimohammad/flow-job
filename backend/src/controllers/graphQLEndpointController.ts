import { Request, Response } from 'express';
import { GraphQLEndpoint } from '../models/GraphQLEndpoint';

export async function listGraphQLEndpoints(req: Request, res: Response) {
  const endpoints = await GraphQLEndpoint.find().sort({ createdAt: -1 });
  res.json(endpoints);
}

export async function createGraphQLEndpoint(req: Request, res: Response) {
  const { url, name } = req.body;
  try {
    if (!url) throw new Error('URL is required');
    const endpoint = await GraphQLEndpoint.create({ url, name });
    res.status(201).json(endpoint);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteGraphQLEndpoint(req: Request, res: Response) {
  await GraphQLEndpoint.findByIdAndDelete(req.params.id);
  res.status(204).send();
}
