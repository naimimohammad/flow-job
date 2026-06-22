import { Router } from 'express';
import * as ctrl from './controllers/workflowController';
import * as requestTaskCtrl from './controllers/requestTaskController';
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

router.post('/api/request-tasks', requestTaskCtrl.createRequestTask);
router.get('/api/request-tasks', requestTaskCtrl.listRequestTasks);
router.get('/api/request-tasks/:id', requestTaskCtrl.getRequestTask);
router.put('/api/request-tasks/:id', requestTaskCtrl.updateRequestTask);
router.delete('/api/request-tasks/:id', requestTaskCtrl.deleteRequestTask);

export default router;
