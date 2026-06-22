import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestTask extends Document {
  name: string;
  endpoint: string;
  operationType: 'query' | 'mutation';
  operation: string;
  query: string;
  variables: any;
  createdAt: Date;
  updatedAt: Date;
}

const RequestTaskSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    endpoint: { type: String, required: true },
    operationType: { type: String, required: true, enum: ['query', 'mutation'] },
    operation: { type: String, required: true },
    query: { type: String, required: true },
    variables: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const RequestTask = mongoose.model<IRequestTask>('RequestTask', RequestTaskSchema);
