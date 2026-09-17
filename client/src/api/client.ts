import type { TasksResponse, TaskResponse, ReorderRequest } from '../types/task';

const BASE_URL = '/api';

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error?.message || `Request failed: ${res.status}`;
      throw new Error(message);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  async getTasks(): Promise<TasksResponse> {
    return this.request<TasksResponse>('/tasks');
  }

  async createTask(data: { title: string; description?: string }): Promise<TaskResponse> {
    return this.request<TaskResponse>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: { title?: string; description?: string }): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<void> {
    return this.request<void>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderTasks(columns: ReorderRequest['columns']): Promise<TasksResponse> {
    return this.request<TasksResponse>('/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ columns }),
    });
  }
}

export const api = new ApiClient();
