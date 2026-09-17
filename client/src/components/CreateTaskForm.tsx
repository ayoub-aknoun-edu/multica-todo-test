import { useState } from 'react';

interface CreateTaskFormProps {
  onSubmit: (title: string, description?: string) => Promise<void>;
  onCancel: () => void;
}

export default function CreateTaskForm({ onSubmit, onCancel }: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="task-form"
      data-testid={`create-form`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
          await onSubmit(title.trim(), description.trim() || undefined);
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
        data-testid="create-title"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        data-testid="create-description"
      />
      <div className="form-actions">
        <button type="submit" disabled={!title.trim() || submitting} data-testid="create-submit">
          Add
        </button>
        <button type="button" onClick={onCancel} data-testid="create-cancel">
          Cancel
        </button>
      </div>
    </form>
  );
}
