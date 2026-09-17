import { useState } from 'react';
import type { Task } from '../types.js';
import EditTaskForm from './EditTaskForm.js';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, patch: { title?: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export default function TaskCard({ task, onUpdate, onDelete, onDragStart, onDragEnd }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <li className="task-card editing" data-card-id={task.id} data-testid={`card-${task.id}`}>
        <EditTaskForm
          task={task}
          onSubmit={async (patch) => {
            await onUpdate(task.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className="task-card"
      data-card-id={task.id}
      data-testid={`card-${task.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-main">
        <h3 className="task-title">{task.title}</h3>
        {task.description ? <p className="task-desc">{task.description}</p> : null}
      </div>
      <div className="task-actions">
        <button className="icon-btn" aria-label={`Edit ${task.title}`} data-testid={`edit-${task.id}`} onClick={() => setEditing(true)}>
          ✎
        </button>
        {confirming ? (
          <span className="confirm-delete">
            <span>Delete?</span>
            <button
              data-testid={`confirm-delete-${task.id}`}
              onClick={async () => {
                await onDelete(task.id);
                setConfirming(false);
              }}
            >
              Yes
            </button>
            <button onClick={() => setConfirming(false)}>No</button>
          </span>
        ) : (
          <button
            className="icon-btn"
            aria-label={`Delete ${task.title}`}
            data-testid={`delete-${task.id}`}
            onClick={() => setConfirming(true)}
          >
            🗑
          </button>
        )}
      </div>
    </li>
  );
}
