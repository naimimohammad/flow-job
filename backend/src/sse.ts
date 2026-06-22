import { EventEmitter } from 'events';
import { Request, Response } from 'express';

const emitters = new Map<string, EventEmitter>();

export function getEmitter(id: string) {
  if (!emitters.has(id)) emitters.set(id, new EventEmitter());
  return emitters.get(id)!;
}

export function emitEvent(executionId: string, type: string, payload: any) {
  const emitter = emitters.get(executionId);
  const data = JSON.stringify({ type, payload, ts: Date.now() });
  if (emitter) emitter.emit('event', data);
}

export function sseHandler(req: Request, res: Response) {
  const executionId = req.params.id as string;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');

  const emitter = getEmitter(executionId);
  const onEvent = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  emitter.on('event', onEvent);

  req.on('close', () => {
    emitter.off('event', onEvent);
  });
}
