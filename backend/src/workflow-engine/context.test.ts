const test = require('node:test');
const assert = require('node:assert/strict');
const { createExecutionContext, storeTaskResult } = require('./context');

test('stores task outputs in shared context for later tasks', () => {
  const context = createExecutionContext({ orderId: '123' });

  storeTaskResult(context, { id: 'task-1', data: { job: 'validateOrder' } }, { valid: true });

  assert.equal(context.orderId, '123');
  assert.deepEqual(context.shared['task-1'], { valid: true });
  assert.deepEqual(context.shared.validateOrder, { valid: true });
  assert.deepEqual(context.results['task-1'], { valid: true });
  assert.deepEqual(context.lastResult, { valid: true });
});

test('stores REST response with body, headers, status in shared context', () => {
  const context = createExecutionContext({ executionId: '456' });

  const restResponse = {
    status: 200,
    statusText: 'OK',
    body: { id: 'user-1', name: 'John' },
    headers: { 'content-type': 'application/json', 'x-request-id': 'abc123' }
  };

  storeTaskResult(context, { id: 'rest-task-1', data: { job: 'getUser' } }, restResponse);

  assert.deepEqual(context.shared['rest-task-1'].body, { id: 'user-1', name: 'John' });
  assert.deepEqual(context.shared['rest-task-1'].headers, { 'content-type': 'application/json', 'x-request-id': 'abc123' });
  assert.equal(context.shared['rest-task-1'].status, 200);
  assert.equal(context.lastResult.status, 200);
});
