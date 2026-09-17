import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.js';
import * as api from '../api.js';
import type { Task } from '../types.js';

vi.mock('../api.js', () => ({
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  reorderTasks: vi.fn(),
  ApiError: class extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));

const mockedApi = vi.mocked(api, true);

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
    description: null,
    status: 'todo',
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('App (board)', () => {
  it('shows loading state, then board with columns', async () => {
    mockedApi.fetchTasks.mockResolvedValue({ tasks: [] });
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeInTheDocument();
    });
    expect(screen.getByTestId('column-todo')).toBeInTheDocument();
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('column-done')).toBeInTheDocument();
  });

  it('shows error state with retry when loading fails', async () => {
    mockedApi.fetchTasks.mockRejectedValue(new Error('network down'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i);
    });
    // retry succeeds
    mockedApi.fetchTasks.mockResolvedValue({ tasks: [] });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeInTheDocument();
    });
  });

  it('creates a task and refreshes', async () => {
    mockedApi.fetchTasks.mockResolvedValueOnce({ tasks: [] });
    mockedApi.createTask.mockResolvedValue({
      task: task({ id: 't1', title: 'New task' }),
    });
    mockedApi.fetchTasks.mockResolvedValueOnce({
      tasks: [task({ id: 't1', title: 'New task' })],
    });

    render(<App />);
    await waitFor(() => screen.getByTestId('board'));
    await userEvent.click(screen.getAllByRole('button', { name: /add task/i })[0]);
    await userEvent.type(screen.getByTestId('create-title'), 'New task');
    await userEvent.click(screen.getByTestId('create-submit'));

    await waitFor(() => {
      expect(mockedApi.createTask).toHaveBeenCalledWith('New task', undefined);
      expect(mockedApi.fetchTasks).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('New task')).toBeInTheDocument();
  });

  it('edits a task title', async () => {
    mockedApi.fetchTasks.mockResolvedValue({
      tasks: [task({ id: 't1', title: 'Old title' })],
    });
    mockedApi.updateTask.mockResolvedValue({
      task: task({ id: 't1', title: 'Edited title' }),
    });

    render(<App />);
    await waitFor(() => screen.getByText('Old title'));
    await userEvent.click(screen.getByTestId('edit-t1'));
    const input = screen.getByTestId('edit-title');
    await userEvent.clear(input);
    await userEvent.type(input, 'Edited title');
    await userEvent.click(screen.getByTestId('edit-save'));

    await waitFor(() => {
      expect(mockedApi.updateTask).toHaveBeenCalledWith('t1', { title: 'Edited title', description: undefined });
    });
  });

  it('deletes a task after confirmation', async () => {
    mockedApi.fetchTasks.mockResolvedValue({
      tasks: [task({ id: 't1', title: 'Doomed' })],
    });
    mockedApi.deleteTask.mockResolvedValue(undefined);

    render(<App />);
    await waitFor(() => screen.getByText('Doomed'));
    await userEvent.click(screen.getByTestId('delete-t1'));
    await userEvent.click(screen.getByTestId('confirm-delete-t1'));

    await waitFor(() => {
      expect(mockedApi.deleteTask).toHaveBeenCalledWith('t1');
    });
  });

  it('reorders when a card is dropped in another column', async () => {
    const a = task({ id: 'a', title: 'A', status: 'todo', position: 0 });
    const b = task({ id: 'b', title: 'B', status: 'todo', position: 1 });
    mockedApi.fetchTasks.mockResolvedValue({ tasks: [a, b] });
    mockedApi.reorderTasks.mockResolvedValue({
      tasks: [
        { ...a, status: 'todo', position: 0 },
        { ...b, status: 'in_progress', position: 0 },
      ],
    });

    render(<App />);
    await waitFor(() => screen.getByText('B'));

    // Simulate native drag & drop: dragStart on card B, drop on in_progress column.
    const cardB = screen.getByTestId('card-b');
    const columnIp = screen.getByTestId('column-in_progress');
    fireEvent.dragStart(cardB, {
      dataTransfer: { setData: vi.fn(), effectAllowed: 'move' },
    });
    fireEvent.dragOver(columnIp, { clientY: 0, dataTransfer: {} });
    fireEvent.drop(columnIp, { clientY: 0, dataTransfer: {} });

    await waitFor(() => {
      expect(mockedApi.reorderTasks).toHaveBeenCalledTimes(1);
    });
    const call = mockedApi.reorderTasks.mock.calls[0][0];
    expect(call.in_progress).toContain('b');
    expect(call.todo).toEqual(['a']);
  });

  it('shows a banner when reorder fails and reloads', async () => {
    const a = task({ id: 'a', title: 'A', status: 'todo', position: 0 });
    mockedApi.fetchTasks.mockResolvedValue({ tasks: [a] });
    mockedApi.reorderTasks.mockRejectedValue(new Error('save failed'));

    render(<App />);
    await waitFor(() => screen.getByText('A'));

    const cardA = screen.getByTestId('card-a');
    const columnIp = screen.getByTestId('column-in_progress');
    fireEvent.dragStart(cardA, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } });
    fireEvent.dragOver(columnIp, { clientY: 0, dataTransfer: {} });
    fireEvent.drop(columnIp, { clientY: 0, dataTransfer: {} });

    await waitFor(
      () => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/save failed/i);
      },
      { timeout: 4000 }
    );
    // refresh() was re-invoked after the failed save (initial load + reload)
    await waitFor(() => {
      expect(mockedApi.fetchTasks.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
