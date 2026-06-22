import { Router } from 'express';
import * as ctrl from './controllers/workflowController';
import { sseHandler } from './sse';

const router = Router();

router.post('/api/workflows', ctrl.createWorkflow);
router.get('/api/workflows', ctrl.listWorkflows);
router.get('/api/workflows/:id', ctrl.getWorkflow);
router.put('/api/workflows/:id', ctrl.updateWorkflow);
router.delete('/api/workflows/:id', ctrl.deleteWorkflow);

router.post('/api/workflows/:id/execute', ctrl.executeWorkflow);
router.get('/api/executions/:id', ctrl.getExecution);
router.get('/api/executions/:id/stream', sseHandler);

export default router;
