import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:4000' });

export async function listWorkflows() {
  const r = await api.get('/api/workflows');
  return r.data;
}

export async function getWorkflow(id: string) {
  const r = await api.get(`/api/workflows/${id}`);
  return r.data;
}

export async function createWorkflow(body: any) {
  const r = await api.post('/api/workflows', body);
  return r.data;
}

export async function updateWorkflow(id: string, body: any) {
  const r = await api.put(`/api/workflows/${id}`, body);
  return r.data;
}

export async function deleteWorkflow(id: string) {
  const r = await api.delete(`/api/workflows/${id}`);
  return r.data;
}

export async function executeWorkflow(id: string, mode = 'function') {
  const r = await api.post(`/api/workflows/${id}/execute`, { mode });
  return r.data;
}

export async function listRequestTasks() {
  const r = await api.get('/api/request-tasks');
  return r.data;
}

export async function createRequestTask(body: any) {
  const r = await api.post('/api/request-tasks', body);
  return r.data;
}

export async function deleteRequestTask(id: string) {
  const r = await api.delete(`/api/request-tasks/${id}`);
  return r.data;
}
