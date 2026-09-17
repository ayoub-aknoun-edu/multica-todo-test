export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: Status;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type Columns = Record<Status, string[]>;

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};
