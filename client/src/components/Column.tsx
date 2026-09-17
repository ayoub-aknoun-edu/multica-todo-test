import { useState } from 'react';
import type { Status, Task } from '../types.js';
import TaskCard from './TaskCard.js';
import CreateTaskForm from './CreateTaskForm.js';

interface ColumnProps {
  status: Status;
  label: string;
  tasks: Task[];
  onCreate: (title: string, description?: string) => Promise<void>;
  onUpdate: (id: string, patch: { title?: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isDragActive: boolean;
  isDropTarget: boolean;
  onDragOverCard: (id: string) => void;
  onDragOverColumn: (status: Status, index: number) => void;
  onDrop: (status: Status, index: number) => void;
  onDragEnd: () => void;
  onComputeDropIndex: (status: Status, e: React.DragEvent) => number;
}

export default function Column({
  status,
  label,
  tasks,
  onCreate,
  onUpdate,
  onDelete,
  isDragActive,
  isDropTarget,
  onDragOverCard,
  onDragOverColumn,
  onDrop,
  onDragEnd,
  onComputeDropIndex,
}: ColumnProps) {
  const [creating, setCreating] = useState(false);

  return (
    <section
      className={
        'board-column' +
        (isDragActive ? ' drag-active' : '') +
        (isDropTarget ? ' drop-target' : '')
      }
      data-testid={`column-${status}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverColumn(status, onComputeDropIndex(status, e));
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(status, onComputeDropIndex(status, e));
      }}
    >
      <header className="column-header">
        <h2>{label}</h2>
        <span className="column-count" data-testid={`count-${status}`}>{tasks.length}</span>
      </header>
      <div className="card-list" data-card-list>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDragStart={() => onDragOverCard(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {tasks.length === 0 && <p className="column-empty">No tasks</p>}
      </div>
      {creating ? (
        <CreateTaskForm
          onSubmit={async (title, description) => {
            await onCreate(title, description);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button className="add-task-btn" onClick={() => setCreating(true)}>
          + Add task
        </button>
      )}
    </section>
  );
}
