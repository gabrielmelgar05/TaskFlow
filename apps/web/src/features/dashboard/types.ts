import type { Workspace } from "@/features/workspaces/workspaces-provider";
import type { Priority, TaskSummary } from "@/features/tasks/types";
export interface DashboardBoard {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  progress: number | null;
}
export interface AttentionTask {
  id: string;
  title: string;
  priority: Priority;
  dueAt: string | null;
  board: { id: string; name: string };
  reason: "OVERDUE" | "DUE_SOON" | "HIGH_PRIORITY";
}
export interface DashboardSummary {
  workspace: Workspace;
  metrics: TaskSummary;
  boards: DashboardBoard[];
  attention: AttentionTask[];
}
