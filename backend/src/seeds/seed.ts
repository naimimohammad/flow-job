import mongoose from 'mongoose';
import { MONGO_URI } from '../config';
import { Workflow } from '../models/Workflow';

async function run() {
  await mongoose.connect(MONGO_URI);
  const existing = await Workflow.findOne({ name: 'order-workflow' });
  if (existing) {
    console.log('Seed already exists');
    process.exit(0);
  }
  const wf = {
    id: 'order-workflow',
    defaultContext: {
      order: {
        id: 'sample-order-1',
        amount: 1200,
        customerEmail: 'customer@example.com'
      }
    },
    nodes: [
      { id: '1', type: 'start' },
      { id: '2', type: 'task', data: { job: 'validateOrder' } },
      { id: '3', type: 'task', data: { job: 'chargePayment' } },
      { id: '4', type: 'task', data: { job: 'sendEmail' } },
      { id: '5', type: 'task', data: { job: 'logs' } },
      { id: '6', type: 'end' }
    ],
    edges: [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
      { source: '3', target: '4' },
      { source: '4', target: '5' }
    ]
  };

  await Workflow.create({ name: 'order-workflow', workflowJson: wf });
  console.log('Seeded workflow');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
