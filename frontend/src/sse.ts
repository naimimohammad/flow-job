export function subscribeExecution(executionId: string, onMessage: (data: any) => void) {
  const url = `http://localhost:4000/api/executions/${executionId}/stream`;
  const es = new EventSource(url);
  const handler = (ev: MessageEvent) => {
    try {
      const payload = JSON.parse(ev.data);
      onMessage(payload);
    } catch (e) {
      console.error('Invalid SSE payload', e);
    }
  };
  es.addEventListener('message', handler);
  es.addEventListener('error', () => { /* noop - client can reconnect if needed */ });
  return () => {
    es.removeEventListener('message', handler);
    es.close();
  };
}
