import type { Columns, Status, Task } from './types.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed with status ${res.status}`
    );
  }
  return body as T;
}

export function fetchTasks(): Promise<{ tasks: Task[] }> {
  return request('/api/tasks');
}

export function createTask(title: string, description?: string): Promise<{ task: Task }> {
  return request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, ...(description ? { description } : {}) }),
  });
}

export function updateTask(
  id: string,
  patch: { title?: string; description?: string }
): Promise<{ task: Task }> {
  return request(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteTask(id: string): Promise<void> {
  return request(`/api/tasks/${id}`, { method: 'DELETE' });
}

export function reorderTasks(columns: Columns): Promise<{ tasks: Task[] }> {
  return request('/api/tasks/reorder', {
    method: 'PUT',
    body: JSON.stringify({ columns }),
  });
}
