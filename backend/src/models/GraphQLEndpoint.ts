import mongoose, { Schema, Document } from 'mongoose';

export interface IGraphQLEndpoint extends Document {
  url: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GraphQLEndpointSchema: Schema = new Schema(
  {
    url: { type: String, required: true, unique: true },
    name: { type: String, default: '' }
  },
  { timestamps: true }
);

export const GraphQLEndpoint = mongoose.model<IGraphQLEndpoint>('GraphQLEndpoint', GraphQLEndpointSchema);
