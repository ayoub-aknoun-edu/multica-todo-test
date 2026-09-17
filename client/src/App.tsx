import { useCallback, useEffect, useState } from 'react';
import type { Columns, Status, Task } from './types.js';
import { STATUS_LABELS } from './types.js';
import * as api from './api.js';
import Board from './components/Board.js';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const groupColumns = useCallback((tasks: Task[]): Columns => {
    const columns: Columns = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) {
      columns[t.status].push(t.id);
    }
    return columns;
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { tasks } = await api.fetchTasks();
      setTasks(tasks);
      return tasks;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (title: string, description?: string) => {
      setBanner(null);
      try {
        await api.createTask(title, description);
        await refresh();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Failed to create task');
      }
    },
    [refresh]
  );

  const handleUpdate = useCallback(
    async (id: string, patch: { title?: string; description?: string }) => {
      setBanner(null);
      try {
        await api.updateTask(id, patch);
        await refresh();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Failed to update task');
      }
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setBanner(null);
      try {
        await api.deleteTask(id);
        await refresh();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Failed to delete task');
      }
    },
    [refresh]
  );

  const handleReorder = useCallback(
    async (columns: Columns) => {
      setBanner(null);
      // Optimistic local reorder; server response is authoritative.
      const byId = new Map(tasks.map((t) => [t.id, t]));
      const reordered: Task[] = [];
      (Object.keys(columns) as Status[]).forEach((status) => {
        columns[status].forEach((id, idx) => {
          const t = byId.get(id);
          if (t) reordered.push({ ...t, status, position: idx });
        });
      });
      setTasks(reordered);
      try {
        const { tasks: serverTasks } = await api.reorderTasks(columns);
        setTasks(serverTasks);
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Failed to save new order');
        await refresh();
      }
    },
    [tasks, refresh]
  );

  if (loading) {
    return <div className="board-loading">Loading tasks…</div>;
  }

  if (error) {
    return (
      <div className="board-error" role="alert">
        <p>Failed to load tasks: {error}</p>
        <button
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Todo Board</h1>
      </header>
      {banner && <div className="banner-error" role="alert">{banner}</div>}
      <Board
        tasks={tasks}
        columns={groupColumns(tasks)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />
    </div>
  );
}
