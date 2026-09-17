import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types/task';
import { STATUS_COLORS } from '../types/task';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, data: { title?: string; description?: string }) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, onUpdate, onDelete, isDragOverlay }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      await onDelete(task.id);
      setIsDeleting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setError(null);
    }
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className={`${STATUS_COLORS[task.status]} border rounded-lg p-3 shadow-sm`}>
        <div className="space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title"
            className="w-full text-sm font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Description (optional)"
            rows={2}
            className="w-full text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !editTitle.trim()}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditTitle(task.title);
                setEditDescription(task.description || '');
                setError(null);
              }}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${STATUS_COLORS[task.status]} border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group`}
    >
      <div className="flex items-start justify-between gap-1">
        <h4 className="text-sm font-medium text-gray-800 flex-1 break-words">{task.title}</h4>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-xs p-1 text-gray-400 hover:text-blue-500 rounded"
            title="Edit task"
          >
            ✎
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }}
            className="text-xs p-1 text-gray-400 hover:text-red-500 rounded"
            title="Delete task"
          >
            ✕
          </button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 mt-1 break-words">{task.description}</p>
      )}

      {/* Delete confirmation */}
      {isDeleting && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Delete this task?</p>
          {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setIsDeleting(false)}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
