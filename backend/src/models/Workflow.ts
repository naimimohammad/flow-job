import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflow extends Document {
  name: string;
  version: number;
  workflowJson: any;
  createdAt: Date;
}

const WorkflowSchema: Schema = new Schema({
  name: { type: String, required: true },
  version: { type: Number, default: 1 },
  workflowJson: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Workflow = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
