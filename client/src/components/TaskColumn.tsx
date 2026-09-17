import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '../types/task';
import { STATUS_LABELS } from '../types/task';
import { TaskCard } from './TaskCard';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onUpdate: (id: string, data: { title?: string; description?: string }) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
}

const COLUMN_HEADER_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

const COLUMN_BORDER_COLORS: Record<TaskStatus, string> = {
  todo: 'border-yellow-300',
  in_progress: 'border-blue-300',
  done: 'border-green-300',
};

export function TaskColumn({ status, tasks, onUpdate, onDelete }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const columnTasks = tasks.filter(t => t.status === status);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-white rounded-lg shadow border-2 min-h-[200px] transition-colors ${
        isOver ? `${COLUMN_BORDER_COLORS[status]} bg-gray-50` : 'border-gray-200'
      }`}
    >
      <div className={`px-3 py-2 rounded-t-md ${COLUMN_HEADER_COLORS[status]} flex items-center justify-between`}>
        <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
        <span className="text-xs font-medium bg-white bg-opacity-50 rounded-full px-2 py-0.5">
          {columnTasks.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {columnTasks.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8 italic">
              Drop tasks here
            </div>
          ) : (
            columnTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
