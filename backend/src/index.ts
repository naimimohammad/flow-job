import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import routes from './routes';
import { PORT, MONGO_URI } from './config';
import { logger } from './utils/logger';
import './workers/worker';

async function start() {
  await mongoose.connect(MONGO_URI);
  logger.info('Connected to MongoDB');

  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '2mb' }));

  app.use(routes);

  app.listen(PORT, () => {
    logger.info(`Server listening on ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start: ' + err.message);
  process.exit(1);
});
