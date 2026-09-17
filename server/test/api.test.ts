import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';

// Isolated DB per test file run: point DB_PATH at a unique temp file before
// the db module is imported, then import the app under test.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dbFile = join(mkdtempSync(join(tmpdir(), 'todo-test-')), 'tasks.db');
process.env.DB_PATH = dbFile;

const { createApp } = await import('../src/app.js');
const { db } = await import('../src/db.js');
import { randomUUID } from 'node:crypto';

let app: Express;

beforeEach(() => {
  db.exec('DELETE FROM tasks');
  app = createApp();
});

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

async function createTask(title: string, description?: string) {
  const res = await request(app).post('/api/tasks').send({ title, description });
  return res.body.task as Task;
}

describe('GET /api/tasks', () => {
  it('returns empty list initially', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tasks: [] });
  });

  it('returns tasks sorted by status then position', async () => {
    const a = await createTask('A');
    const b = await createTask('B');
    // move B to in_progress via reorder
    await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [b.id], in_progress: [a.id], done: [] } });
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks[0].id).toBe(b.id); // in_progress first
    expect(res.body.tasks[1].id).toBe(a.id);
    expect(res.body.tasks[0].position).toBe(0);
    expect(res.body.tasks[1].position).toBe(0);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task in todo at end', async () => {
    const t1 = await createTask('First', 'desc-1');
    expect(t1.status).toBe('todo');
    expect(t1.position).toBe(0);
    expect(t1.title).toBe('First');
    expect(t1.description).toBe('desc-1');
    expect(t1.id).toBeDefined();
    expect(t1.createdAt).toBeDefined();
    expect(t1.updatedAt).toBeDefined();

    const t2 = await createTask('Second');
    expect(t2.position).toBe(1);
  });

  it('rejects empty title', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing title', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-string description', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', description: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates title and description', async () => {
    const t = await createTask('Original');
    const res = await request(app)
      .patch(`/api/tasks/${t.id}`)
      .send({ title: 'Updated', description: 'new desc' });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Updated');
    expect(res.body.task.description).toBe('new desc');
  });

  it('partial update keeps other fields', async () => {
    const t = await createTask('Original', 'keep');
    const res = await request(app).patch(`/api/tasks/${t.id}`).send({ title: 'Only title' });
    expect(res.body.task.title).toBe('Only title');
    expect(res.body.task.description).toBe('keep');
  });

  it('returns 404 for unknown id with error shape', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${randomUUID()}`)
      .send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
  });

  it('rejects empty title', async () => {
    const t = await createTask('Original');
    const res = await request(app).patch(`/api/tasks/${t.id}`).send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes and compacts positions', async () => {
    const a = await createTask('A');
    const b = await createTask('B');
    const c = await createTask('C');
    const res = await request(app).delete(`/api/tasks/${b.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const list = (await request(app).get('/api/tasks')).body.tasks as Task[];
    expect(list.map((t) => t.id)).toEqual([a.id, c.id]);
    expect(list.map((t) => t.position)).toEqual([0, 1]);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete(`/api/tasks/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe('PUT /api/tasks/reorder', () => {
  it('moves a task across columns and preserves order', async () => {
    const a = await createTask('A');
    const b = await createTask('B');
    const c = await createTask('C');
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [b.id], in_progress: [a.id], done: [c.id] } });
    expect(res.status).toBe(200);
    const tasks = res.body.tasks as Task[];
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get(a.id)!.status).toBe('in_progress');
    expect(byId.get(a.id)!.position).toBe(0);
    expect(byId.get(b.id)!.status).toBe('todo');
    expect(byId.get(b.id)!.position).toBe(0);
    expect(byId.get(c.id)!.status).toBe('done');
    expect(byId.get(c.id)!.position).toBe(0);
  });

  it('reorders within one column', async () => {
    const a = await createTask('A');
    const b = await createTask('B');
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [b.id, a.id], in_progress: [], done: [] } });
    expect(res.status).toBe(200);
    const tasks = res.body.tasks as Task[];
    expect(tasks.filter((t) => t.status === 'todo').map((t) => t.id)).toEqual([b.id, a.id]);
    expect(tasks.map((t) => t.position).sort()).toEqual([0, 1]);
  });

  it('rejects missing task id in payload', async () => {
    const a = await createTask('A');
    const b = await createTask('B');
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [a.id], in_progress: [], done: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.missingIds).toContain(b.id);
  });

  it('rejects duplicate task id in payload', async () => {
    const a = await createTask('A');
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [a.id, a.id], in_progress: [], done: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.duplicateIds).toContain(a.id);
  });

  it('rejects unknown task id in payload', async () => {
    const a = await createTask('A');
    const fake = randomUUID();
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [a.id], in_progress: [fake], done: [] } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    expect(res.body.error.details.unknownIds).toContain(fake);
  });

  it('persists across fresh requests', async () => {
    const a = await createTask('A');
    await request(app)
      .put('/api/tasks/reorder')
      .send({ columns: { todo: [], in_progress: [a.id], done: [] } });
    const list = (await request(app).get('/api/tasks')).body.tasks as Task[];
    expect(list[0].status).toBe('in_progress');
  });
});

describe('API misc', () => {
  it('404s unknown routes with error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400s invalid JSON body', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
