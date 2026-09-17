import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { Status, Task } from './types.js';

const DB_PATH = process.env.DB_PATH ?? 'tasks.db';

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON tasks (status, position);
`);

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Status,
    position: Number(row.position),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectAll = db.prepare(
  "SELECT * FROM tasks ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, position"
);
const selectById = db.prepare('SELECT * FROM tasks WHERE id = ?');
const selectByStatus = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY position');
const selectMaxPosition = db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM tasks WHERE status = ?');
const insertTask = db.prepare(
  'INSERT INTO tasks (id, title, description, status, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

export function listTasks(): Task[] {
  return (selectAll.all() as unknown as TaskRow[]).map(rowToTask);
}

export function getTask(id: string): Task | undefined {
  const row = selectById.get(id) as unknown as TaskRow | undefined;
  return row ? rowToTask(row) : undefined;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const { max } = selectMaxPosition.get('todo') as unknown as { max: number };
  const task = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    status: 'todo' as Status,
    position: max + 1,
    createdAt: now,
    updatedAt: now,
  };
  insertTask.run(
    task.id,
    task.title,
    task.description,
    task.status,
    task.position,
    task.createdAt,
    task.updatedAt
  );
  return task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
}

export function updateTask(id: string, input: UpdateTaskInput): Task | undefined {
  const existing = getTask(id);
  if (!existing) return undefined;
  const title = input.title ?? existing.title;
  const description =
    input.description !== undefined ? input.description : (existing.description ?? null);
  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET title = ?, description = ?, updated_at = ? WHERE id = ?').run(
    title,
    description,
    now,
    id
  );
  return getTask(id);
}

class ReorderError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

/**
 * Reorder payload: for each column, the ordered list of task ids.
 * Every existing task id must appear exactly once across the payload.
 * Runs in a single transaction; throws ReorderError without applying
 * anything when validation fails.
 */
/**
 * Run `fn` inside a single transaction. node:sqlite has no db.transaction()
 * helper, so BEGIN/COMMIT/ROLLBACK are issued manually.
 */
function inTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // connection may not have an open transaction; nothing to roll back
    }
    throw err;
  }
}

export function reorderTasks(columns: Record<Status, string[]>): Task[] {
  const apply = () => {
    const statusById = new Map<string, Status>();
    (Object.keys(columns) as Status[]).forEach((status) => {
      columns[status].forEach((id) => statusById.set(id, status));
    });

    const all = db.prepare('SELECT id FROM tasks').all() as unknown as { id: string }[];
    const existingIds = new Set(all.map((r) => r.id));
    const payloadIds: string[] = [];
    (Object.keys(columns) as Status[]).forEach((status) => {
      payloadIds.push(...columns[status]);
    });

    // Unknown ids in payload
    const unknown = payloadIds.filter((id) => !existingIds.has(id));
    if (unknown.length > 0) {
      throw new ReorderError(404, 'TASK_NOT_FOUND', `Unknown task id(s): ${unknown.join(', ')}`, {
        unknownIds: unknown,
      });
    }

    // Duplicate ids in payload
    const seen = new Set<string>();
    const dupes = payloadIds.filter((id) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    if (dupes.length > 0) {
      throw new ReorderError(
        400,
        'VALIDATION_ERROR',
        `Task id(s) appear more than once: ${[...new Set(dupes)].join(', ')}`,
        { duplicateIds: [...new Set(dupes)] }
      );
    }

    // Missing ids (exist in db but absent from payload)
    const missing = [...existingIds].filter((id) => !statusById.has(id));
    if (missing.length > 0) {
      throw new ReorderError(
        400,
        'VALIDATION_ERROR',
        'Reorder payload must include every existing task exactly once',
        { missingIds: missing }
      );
    }

    const now = new Date().toISOString();
    const update = db.prepare('UPDATE tasks SET status = ?, position = ?, updated_at = ? WHERE id = ?');
    (Object.keys(columns) as Status[]).forEach((status) => {
      columns[status].forEach((id, idx) => {
        update.run(status, idx, now, id);
      });
    });
  };

  inTransaction(apply);
  return listTasks();
}

export function deleteTask(id: string): boolean {
  return inTransaction((): boolean => {
    const existing = getTask(id);
    if (!existing) return false;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    const siblings = selectByStatus.all(existing.status) as unknown as TaskRow[];
    siblings.forEach((row, idx) => {
      if (Number(row.position) !== idx) {
        db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(idx, row.id);
      }
    });
    return true;
  });
}
