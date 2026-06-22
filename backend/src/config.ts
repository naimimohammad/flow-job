import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flowdb';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
