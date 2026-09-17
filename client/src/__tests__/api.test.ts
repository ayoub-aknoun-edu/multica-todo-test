import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api/client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getTasks fetches and returns tasks', async () => {
    const mockTasks = { tasks: [{ id: '1', title: 'Test', status: 'todo', position: 0, createdAt: '', updatedAt: '' }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockTasks),
    } as Response);

    const result = await api.getTasks();
    expect(result).toEqual(mockTasks);
    expect(fetch).toHaveBeenCalledWith('/api/tasks', {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('createTask sends POST with body', async () => {
    const newTask = { task: { id: '2', title: 'New', status: 'todo', position: 0, createdAt: '', updatedAt: '' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(newTask),
    } as Response);

    const result = await api.createTask({ title: 'New' });
    expect(result).toEqual(newTask);
    expect(fetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New' }),
    });
  });

  it('updateTask sends PATCH with body', async () => {
    const updated = { task: { id: '1', title: 'Updated', status: 'todo', position: 0, createdAt: '', updatedAt: '' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(updated),
    } as Response);

    const result = await api.updateTask('1', { title: 'Updated' });
    expect(result).toEqual(updated);
    expect(fetch).toHaveBeenCalledWith('/api/tasks/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
  });

  it('deleteTask sends DELETE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    } as Response);

    await api.deleteTask('1');
    expect(fetch).toHaveBeenCalledWith('/api/tasks/1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('reorderTasks sends PUT with columns', async () => {
    const tasks = { tasks: [{ id: '1', title: 'T1', status: 'todo', position: 0, createdAt: '', updatedAt: '' }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(tasks),
    } as Response);

    const columns = { todo: ['1'], in_progress: [], done: [] };
    const result = await api.reorderTasks(columns);
    expect(result).toEqual(tasks);
    expect(fetch).toHaveBeenCalledWith('/api/tasks/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: { todo: ["1"], in_progress: [], done: [] } }),
    });
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { code: 'INTERNAL', message: 'Server error' } }),
    } as Response);

    await expect(api.getTasks()).rejects.toThrow('Server error');
  });

  it('throws generic error on non-json error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    } as Response);

    await expect(api.getTasks()).rejects.toThrow('Request failed: 500');
  });
});
