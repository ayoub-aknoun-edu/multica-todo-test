import { useState } from 'react';
import type { Columns, Status, Task } from '../types.js';
import { STATUSES, STATUS_LABELS } from '../types.js';
import Column from './Column.js';

interface BoardProps {
  tasks: Task[];
  columns: Columns;
  onCreate: (title: string, description?: string) => Promise<void>;
  onUpdate: (id: string, patch: { title?: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (columns: Columns) => Promise<void>;
}

/**
 * Native HTML5 drag and drop. Draggable task cards carry their id via
 * dataTransfer; columns are drop targets. Drops compute the new ordering
 * across all three columns (within-column move or cross-column move) and
 * delegate persistence to onReorder.
 */
export default function Board({ tasks, columns, onCreate, onUpdate, onDelete, onReorder }: BoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: Status; index: number } | null>(null);

  const byId = new Map(tasks.map((t) => [t.id, t]));

  function computeDrop(status: Status, e: React.DragEvent): number {
    const column = columns[status];
    const container = (e.currentTarget as HTMLElement).querySelector('[data-card-list]') as HTMLElement | null;
    if (!container || column.length === 0) return 0;
    const cards = Array.from(container.querySelectorAll('[data-card-id]')) as HTMLElement[];
    const mouseY = e.clientY;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (mouseY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }

  function applyDrop(status: Status, index: number) {
    if (!dragId) return;
    const fromStatus = byId.get(dragId)?.status;
    if (!fromStatus) return;

    // Build new ordering: remove dragged id from its column, insert at target.
    const next: Columns = {
      todo: [...columns.todo],
      in_progress: [...columns.in_progress],
      done: [...columns.done],
    };
    next[fromStatus] = next[fromStatus].filter((id) => id !== dragId);
    if (fromStatus === status) {
      // within-column move: insertion index relative to list after removal
      next[status].splice(index > (columns[status].indexOf(dragId)) ? index - 1 : index, 0, dragId);
    } else {
      next[status].splice(index, 0, dragId);
    }
    setDragId(null);
    setDropTarget(null);
    void onReorder(next);
  }

  return (
    <div className="board" data-testid="board">
      {STATUSES.map((status) => (
        <Column
          key={status}
          status={status}
          label={STATUS_LABELS[status]}
          tasks={columns[status].map((id) => byId.get(id)!).filter(Boolean)}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isDragActive={dragId !== null}
          isDropTarget={dropTarget?.status === status}
          onDragOverCard={(id) => setDragId(id)}
          onDragOverColumn={(status, index) => setDropTarget({ status, index })}
          onDrop={(status, index) => applyDrop(status, index)}
          onDragEnd={() => { setDragId(null); setDropTarget(null); }}
          onComputeDropIndex={(status, e) => computeDrop(status, e)}
        />
      ))}
    </div>
  );
}
