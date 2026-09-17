import express, { type Express } from 'express';
import cors from 'cors';
import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from './db.js';
import { HttpError, errorHandler, notFoundHandler } from './errors.js';
import { STATUSES, type Status } from './types.js';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // GET /api/tasks -> { tasks: Task[] } sorted by status then position
  app.get('/api/tasks', (_req, res) => {
    res.json({ tasks: listTasks() });
  });

  // POST /api/tasks { title, description? } -> { task } created in todo at end
  app.post('/api/tasks', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = body.title;
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'title is required and must be a non-empty string'
      );
    }
    if (title.length > 500) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'title must be at most 500 characters');
    }
    const { description } = body;
    if (description !== undefined && typeof description !== 'string') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'description must be a string');
    }
    const task = createTask({ title: title.trim(), description });
    res.status(201).json({ task });
  });

  // PATCH /api/tasks/:id { title?, description? } -> { task }
  app.patch('/api/tasks/:id', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = ['title', 'description'];
    const keys = Object.keys(body);
    if (keys.length === 0) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'At least one of title or description is required');
    }
    const unknownKeys = keys.filter((k) => !allowed.includes(k));
    if (unknownKeys.length > 0) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        `Unknown field(s): ${unknownKeys.join(', ')}`
      );
    }
    const { title, description } = body;
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'title must be a non-empty string');
    }
    if (title !== undefined && title.length > 500) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'title must be at most 500 characters');
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'description must be a string');
    }
    const task = updateTask(req.params.id, {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
    });
    if (!task) {
      throw new HttpError(404, 'TASK_NOT_FOUND', `Task ${req.params.id} not found`);
    }
    res.json({ task });
  });

  // DELETE /api/tasks/:id -> 204, compact positions in the affected column
  app.delete('/api/tasks/:id', (req, res) => {
    const deleted = deleteTask(req.params.id);
    if (!deleted) {
      throw new HttpError(404, 'TASK_NOT_FOUND', `Task ${req.params.id} not found`);
    }
    res.status(204).send();
  });

  // PUT /api/tasks/reorder { columns: { todo: [], in_progress: [], done: [] } } -> { tasks }
  app.put('/api/tasks/reorder', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const columns = body.columns as Record<string, unknown> | undefined;
    if (!columns || typeof columns !== 'object') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'columns object is required');
    }
    for (const status of STATUSES) {
      const ids = columns[status];
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          `columns.${status} must be an array of task ids`
        );
      }
    }
    const tasks = reorderTasks({
      todo: columns.todo as string[],
      in_progress: columns.in_progress as string[],
      done: columns.done as string[],
    });
    res.json({ tasks });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
