import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { Task, TaskStatus, ReorderRequest } from '../types/task';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (title: string, description?: string) => Promise<Task>;
  updateTask: (id: string, data: { title?: string; description?: string }) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (columns: ReorderRequest['columns']) => Promise<void>;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTasks();
      setTasks(res.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = useCallback(async (title: string, description?: string): Promise<Task> => {
    const res = await api.createTask({ title, description });
    setTasks(prev => [...prev, res.task]);
    return res.task;
  }, []);

  const updateTask = useCallback(async (id: string, data: { title?: string; description?: string }): Promise<Task> => {
    const res = await api.updateTask(id, data);
    setTasks(prev => prev.map(t => t.id === id ? res.task : t));
    return res.task;
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const reorderTasks = useCallback(async (columns: ReorderRequest['columns']): Promise<void> => {
    const res = await api.reorderTasks(columns);
    setTasks(res.tasks);
  }, []);

  return { tasks, loading, error, refresh, createTask, updateTask, deleteTask, reorderTasks };
}
