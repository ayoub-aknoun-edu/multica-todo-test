import { useState } from 'react';
import type { Task } from '../types.js';

interface EditTaskFormProps {
  task: Task;
  onSubmit: (patch: { title?: string; description?: string }) => Promise<void>;
  onCancel: () => void;
}

export default function EditTaskForm({ task, onSubmit, onCancel }: EditTaskFormProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="task-form"
      data-testid="edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
          await onSubmit({ title: title.trim(), description: description.trim() || undefined });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <input
        autoFocus
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="edit-title"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        data-testid="edit-description"
      />
      <div className="form-actions">
        <button type="submit" disabled={!title.trim() || submitting} data-testid="edit-save">
          Save
        </button>
        <button type="button" onClick={onCancel} data-testid="edit-cancel">
          Cancel
        </button>
      </div>
    </form>
  );
}
