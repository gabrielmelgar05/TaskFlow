export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export interface Person {
  id: string;
  name: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  columnId: string;
  position: number;
  creator: Person;
  assignee: Person | null;
  createdAt: string;
  updatedAt: string;
}
export interface TaskInput {
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  assigneeId: string | null;
}
export interface TaskSummary {
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
export const priorityLabels: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};
