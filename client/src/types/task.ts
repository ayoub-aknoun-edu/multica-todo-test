export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}

export interface ReorderRequest {
  columns: {
    todo: string[];
    in_progress: string[];
    done: string[];
  };
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-yellow-50 border-yellow-200',
  in_progress: 'bg-blue-50 border-blue-200',
  done: 'bg-green-50 border-green-200',
};
