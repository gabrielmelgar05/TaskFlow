import type {
  TaskPriority,
  WorkspaceRole,
} from '../generated/prisma/client.js';

export interface DashboardMetrics {
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
export interface DashboardBoard {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  progress: number | null;
}
export type AttentionReason = 'OVERDUE' | 'DUE_SOON' | 'HIGH_PRIORITY';
export interface AttentionTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueAt: string | null;
  board: { id: string; name: string };
  reason: AttentionReason;
}
export interface DashboardSummary {
  workspace: { id: string; name: string; role: WorkspaceRole };
  metrics: DashboardMetrics;
  boards: DashboardBoard[];
  attention: AttentionTask[];
}
