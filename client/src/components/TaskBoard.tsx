import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '../types/task';
import { useTasks } from '../hooks/useTasks';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { CreateTask } from './CreateTask';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

export function TaskBoard() {
  const { tasks, loading, error, refresh, createTask, updateTask, deleteTask, reorderTasks } = useTasks();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const task of tasks) {
      map[task.status].push(task);
    }
    return map;
  }, [tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
    setReorderError(null);
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine source and target columns
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if over is a column (droppable) or a task
    const overTask = tasks.find(t => t.id === overId);
    const targetStatus: TaskStatus = overTask
      ? overTask.status
      : COLUMNS.includes(overId as TaskStatus)
        ? overId as TaskStatus
        : activeTask.status;

    if (activeTask.status !== targetStatus) {
      // Moving to a different column — eagerly update for smooth visual feedback
      // We'll use a local state management approach
    }
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Determine target column
    const overTask = tasks.find(t => t.id === overId);
    let targetStatus: TaskStatus;
    if (overTask) {
      targetStatus = overTask.status;
    } else if (COLUMNS.includes(overId as TaskStatus)) {
      targetStatus = overId as TaskStatus;
    } else {
      return;
    }

    // Build the new column arrays
    const sourceCol = tasksByStatus[activeTask.status].map(t => t.id);
    const targetCol = tasksByStatus[targetStatus].map(t => t.id);

    // Remove from source
    const sourceIndex = sourceCol.indexOf(activeId);
    if (sourceIndex !== -1) sourceCol.splice(sourceIndex, 1);

    if (activeTask.status === targetStatus) {
      // Same column: reorder
      const targetIndex = sourceCol.indexOf(overId);
      sourceCol.splice(targetIndex, 0, activeId);

      const newColumns = {
        todo: activeTask.status === 'todo' ? sourceCol : tasksByStatus.todo.map(t => t.id),
        in_progress: activeTask.status === 'in_progress' ? sourceCol : tasksByStatus.in_progress.map(t => t.id),
        done: activeTask.status === 'done' ? sourceCol : tasksByStatus.done.map(t => t.id),
      };

      try {
        await reorderTasks(newColumns);
        setReorderError(null);
      } catch (err) {
        setReorderError(err instanceof Error ? err.message : 'Failed to reorder');
        refresh();
      }
    } else {
      // Different column
      let targetIndex: number;
      if (overTask) {
        targetIndex = targetCol.indexOf(overId);
        targetCol.splice(targetIndex, 0, activeId);
      } else {
        targetCol.push(activeId);
      }

      const newColumns = {
        todo: activeTask.status === 'todo' ? sourceCol : (targetStatus === 'todo' ? targetCol : tasksByStatus.todo.map(t => t.id)),
        in_progress: activeTask.status === 'in_progress' ? sourceCol : (targetStatus === 'in_progress' ? targetCol : tasksByStatus.in_progress.map(t => t.id)),
        done: activeTask.status === 'done' ? sourceCol : (targetStatus === 'done' ? targetCol : tasksByStatus.done.map(t => t.id)),
      };

      try {
        await reorderTasks(newColumns);
        setReorderError(null);
      } catch (err) {
        setReorderError(err instanceof Error ? err.message : 'Failed to reorder');
        refresh();
      }
    }
  }, [tasks, tasksByStatus, reorderTasks, refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-3xl">⚠</div>
          <h2 className="text-lg font-semibold text-gray-700">Failed to load tasks</h2>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refresh}
            className="text-sm px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Header with create */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Todo Board</h1>
          <button
            onClick={refresh}
            className="text-xs px-3 py-1.5 text-gray-500 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            title="Refresh tasks"
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={refresh} className="text-xs underline ml-4">Retry</button>
          </div>
        )}

        {reorderError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg px-4 py-2">
            {reorderError}
          </div>
        )}

        <div className="mb-4">
          <CreateTask onCreate={createTask} />
        </div>

        {/* Board columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(status => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasks}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 opacity-90 max-w-[calc(33vw-2rem)]">
            <TaskCard
              task={activeTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
