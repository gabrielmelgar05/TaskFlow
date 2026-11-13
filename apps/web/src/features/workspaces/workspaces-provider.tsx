"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useApiResource } from "@/hooks/use-api-resource";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
}
export function canManage(role?: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

function readSelection(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function useWorkspaceState() {
  const { session } = useAuth();
  const storageKey = `taskflow:workspace:${session.user?.id ?? ""}`;
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    readSelection(storageKey),
  );
  const resource = useApiResource<Workspace[]>("/workspaces");
  const workspaces = resource.data ?? [];
  const selected =
    workspaces.find((workspace) => workspace.id === selectedId) ??
    workspaces[0];
  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      // Apenas uma preferência de seleção. Os registros sempre vêm da API.
      try {
        sessionStorage.setItem(storageKey, id);
      } catch {
        /* armazenamento opcional */
      }
    },
    [storageKey],
  );
  return { ...resource, workspaces, selected, select };
}
const WorkspacesContext = createContext<ReturnType<
  typeof useWorkspaceState
> | null>(null);
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return (
    <WorkspacesContext.Provider value={state}>
      {children}
    </WorkspacesContext.Provider>
  );
}
export function useWorkspaces() {
  const context = useContext(WorkspacesContext);
  if (!context) throw new Error("useWorkspaces requer WorkspacesProvider.");
  return context;
}
