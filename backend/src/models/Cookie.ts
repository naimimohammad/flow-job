import mongoose, { Schema, Document } from 'mongoose';

export interface ICookie extends Document {
  name: string;
  requestName: string;
  value: string;
}

const CookieSchema: Schema = new Schema({
  name: { type: String, required: true },
  requestName: { type: String, required: true },
  value: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const Cookie = mongoose.model<ICookie>('Cookie', CookieSchema);
