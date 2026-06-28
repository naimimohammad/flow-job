import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestTask extends Document {
  name: string;
  endpoint: string;
  requestType: 'graphql' | 'rest';
  operationType?: 'query' | 'mutation';
  operation?: string;
  query?: string;
  variables?: any;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: any;
  body?: any;
  createdAt: Date;
  updatedAt: Date;
}

const RequestTaskSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    endpoint: { type: String, required: true },
    requestType: { type: String, required: true, enum: ['graphql', 'rest'], default: 'graphql' },
    operationType: { type: String, enum: ['query', 'mutation'] },
    operation: { type: String },
    query: { type: String },
    variables: { type: Schema.Types.Mixed, default: {} },
    httpMethod: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
    headers: { type: Schema.Types.Mixed, default: {} },
    body: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const RequestTask = mongoose.model<IRequestTask>('RequestTask', RequestTaskSchema);
