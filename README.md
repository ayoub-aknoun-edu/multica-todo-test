# Todo Board Test

A small Kanban-style todo application used to validate multi-agent software
development (System Architect -> Backend Developer / Frontend Developer ->
Code Reviewer).

## Stack

- **server/** — Express + node:sqlite API, TypeScript, Vitest integration tests
- **client/** — Vite + React UI, native HTML5 drag & drop, Vitest/Testing Library tests
- Root scripts orchestrate both workspaces (npm workspaces)

## Task model

`{ id, title, description?, status, position, createdAt, updatedAt }` where
`status` is exactly `todo | in_progress | done` and `position` is zero-based
within its column.

## API

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/tasks` | — | `{ tasks: Task[] }` sorted by status then position |
| POST | `/api/tasks` | `{ title, description? }` | `201 { task }` created in `todo` at end |
| PATCH | `/api/tasks/:id` | `{ title?, description? }` | `200 { task }` |
| DELETE | `/api/tasks/:id` | — | `204`, positions compacted |
| PUT | `/api/tasks/reorder` | `{ columns: { todo, in_progress, done } }` | `200 { tasks }` |

Errors use `{ error: { code, message, details? } }`.

The reorder payload must contain every existing task id exactly once;
violations return `400 VALIDATION_ERROR` (duplicate/missing) or
`404 TASK_NOT_FOUND` (unknown id).

## Run

```bash
npm install          # root, installs both workspaces
npm run dev          # API on :3001, Vite dev server on :5173 (proxies /api)
npm test             # server + client tests
npm run build        # typecheck + build both workspaces
```

The SQLite database is `server/tasks.db` (override with `DB_PATH`). It is
created automatically on first start; delete it to reset. Requires Node.js 24+
(built-in `node:sqlite`).
