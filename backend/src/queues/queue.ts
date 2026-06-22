import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { REDIS_URL } from '../config';

const connection = new IORedis(REDIS_URL);

export const jobQueue = new Queue('flow-jobs', { connection });

export async function enqueue(jobName: string, data: any, opts = {}) {
  return jobQueue.add(jobName, data, opts);
}
