import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { REDIS_URL } from '../config';
import { registry } from '../registry';
import { logger } from '../utils/logger';

const connection = new IORedis(REDIS_URL);

const worker = new Worker(
  'flow-jobs',
  async (job: Job) => {
    const handler = registry[job.name];
    if (!handler) throw new Error(`No handler for job ${job.name}`);
    logger.info(`Worker executing job ${job.name}`);
    return handler(job.data || {});
  },
  { connection }
);

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

export default worker;
