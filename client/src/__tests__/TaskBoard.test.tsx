import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskBoard } from '../components/TaskBoard';
import type { Task } from '../types/task';

const mockTasks: Task[] = [
  { id: '1', title: 'Task 1', description: 'First task', status: 'todo', position: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '2', title: 'Task 2', status: 'todo', position: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '3', title: 'Task 3', status: 'in_progress', position: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '4', title: 'Task 4', status: 'done', position: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

// Mock the API module
vi.mock('../api/client', () => ({
  api: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    reorderTasks: vi.fn(),
  },
}));

import { api } from '../api/client';

function mockGetTasks(tasks: Task[] = mockTasks) {
  vi.mocked(api.getTasks).mockResolvedValue({ tasks });
}

function mockCreateTask(task: Task) {
  vi.mocked(api.createTask).mockResolvedValue({ task });
}

function mockUpdateTask(task: Task) {
  vi.mocked(api.updateTask).mockResolvedValue({ task });
}

function mockDeleteTask() {
  vi.mocked(api.deleteTask).mockResolvedValue(undefined);
}

function mockReorderTasks(tasks: Task[] = mockTasks) {
  vi.mocked(api.reorderTasks).mockResolvedValue({ tasks });
}

describe('TaskBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getTasks).mockReturnValue(new Promise(() => {})); // never resolves
    render(<TaskBoard />);
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    vi.mocked(api.getTasks).mockRejectedValue(new Error('Network error'));
    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders tasks in correct columns', async () => {
    mockGetTasks();
    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    // Check column headers exist
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    // Check tasks are in the right columns by finding column containers
    const todoColumn = screen.getByText('Todo').closest('div')?.parentElement;
    const inProgressColumn = screen.getByText('In Progress').closest('div')?.parentElement;
    const doneColumn = screen.getByText('Done').closest('div')?.parentElement;

    expect(todoColumn).toBeTruthy();
    expect(inProgressColumn).toBeTruthy();
    expect(doneColumn).toBeTruthy();

    // Task 1 and 2 in Todo
    expect(within(todoColumn!).getByText('Task 1')).toBeInTheDocument();
    expect(within(todoColumn!).getByText('Task 2')).toBeInTheDocument();
    // Task 3 in In Progress
    expect(within(inProgressColumn!).getByText('Task 3')).toBeInTheDocument();
    // Task 4 in Done
    expect(within(doneColumn!).getByText('Task 4')).toBeInTheDocument();
  });

  it('shows column task counts', async () => {
    mockGetTasks();
    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    // Check counts: Todo=2, In Progress=1, Done=1
    const counts = screen.getAllByText(/^\d+$/);
    expect(counts).toHaveLength(3);
    expect(counts[0].textContent).toBe('2'); // Todo
    expect(counts[1].textContent).toBe('1'); // In Progress
    expect(counts[2].textContent).toBe('1'); // Done
  });

  it('creates a new task', async () => {
    mockGetTasks();
    const newTask: Task = {
      id: '5',
      title: 'New Task',
      status: 'todo',
      position: 2,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockCreateTask(newTask);

    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Click "Add Task" button
    await user.click(screen.getByText('+ Add Task'));

    // Fill in the form
    const titleInput = screen.getByPlaceholderText('Task title');
    await user.type(titleInput, 'New Task');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith({ title: 'New Task', description: undefined });
    });
  });

  it('deletes a task', async () => {
    mockGetTasks();
    mockDeleteTask();

    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Hover over Task 1 card to reveal delete button
    const taskCard = screen.getByText('Task 1').closest('div')!;
    await user.hover(taskCard);

    // Click delete button (the ✕ button)
    const deleteBtn = within(taskCard).getByTitle('Delete task');
    await user.click(deleteBtn);

    // Confirm deletion
    await waitFor(() => {
      expect(screen.getByText('Delete this task?')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(api.deleteTask).toHaveBeenCalledWith('1');
    });
  });

  it('edits a task', async () => {
    mockGetTasks();
    const updatedTask: Task = { ...mockTasks[0], title: 'Updated Task', description: 'New desc' };
    mockUpdateTask(updatedTask);

    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Hover to reveal edit button
    const taskCard = screen.getByText('Task 1').closest('div')!;
    await user.hover(taskCard);

    const editBtn = within(taskCard).getByTitle('Edit task');
    await user.click(editBtn);

    // Edit form appears
    const titleInput = screen.getByDisplayValue('Task 1');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Task');

    const descInput = screen.getByPlaceholderText('Description (optional)');
    await user.clear(descInput);
    await user.type(descInput, 'New desc');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith('1', {
        title: 'Updated Task',
        description: 'New desc',
      });
    });
  });

  it('shows empty state in columns', async () => {
    mockGetTasks([]);
    render(<TaskBoard />);
    await waitFor(() => {
      const emptyTexts = screen.getAllByText('Drop tasks here');
      expect(emptyTexts).toHaveLength(3);
    });
  });

  it('has a refresh button', async () => {
    mockGetTasks();
    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('↻ Refresh'));
    expect(api.getTasks).toHaveBeenCalledTimes(2); // initial + refresh
  });
});
