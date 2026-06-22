import mongoose, { Schema, Document } from 'mongoose';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface IExecution extends Document {
  workflowId: string;
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  logs: string[];
}

const ExecutionSchema: Schema = new Schema({
  workflowId: { type: String, required: true },
  status: { type: String, required: true },
  startedAt: Date,
  completedAt: Date,
  logs: { type: [String], default: [] }
});

export const Execution = mongoose.model<IExecution>('Execution', ExecutionSchema);
