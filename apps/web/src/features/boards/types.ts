import type { Workspace } from "@/features/workspaces/workspaces-provider";
export interface Board {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}
export interface BoardDetail extends Board {
  workspace: Workspace;
  columns: { id: string; name: string; position: number }[];
}
export function boardHref(id: string) {
  return `/quadros/detalhes/?id=${encodeURIComponent(id)}`;
}
