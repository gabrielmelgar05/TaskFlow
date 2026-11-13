import type { Workspace } from "@/features/workspaces/workspaces-provider";
export interface Board {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}
export interface BoardDetail extends Board {
  workspace: Workspace;
  columns: BoardColumn[];
}
export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  status: "TODO" | "IN_PROGRESS" | "DONE";
}
export function boardHref(id: string, taskId?: string) {
  return `/quadros/detalhes/?id=${encodeURIComponent(id)}${taskId ? `&task=${encodeURIComponent(taskId)}` : ""}`;
}
