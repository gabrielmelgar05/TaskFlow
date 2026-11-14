"use client";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { canManage, useWorkspaces } from "./workspaces-provider";
import type { ResourceAction } from "@/features/boards/resource-dialog";

export function WorkspaceToolbar({
  onAction,
  onSelect,
}: {
  onAction: (action: ResourceAction) => void;
  onSelect?: () => void;
}) {
  const workspaces = useWorkspaces();
  const workspace = workspaces.selected;
  if (!workspace) return null;
  return (
    <div className="workspace-toolbar">
      <div className="workspace-selector">
        <label htmlFor="workspace-selection">Workspace atual</label>
        <Select
          id="workspace-selection"
          value={workspace.id}
          onValueChange={(value) => {
            workspaces.select(value);
            onSelect?.();
          }}
          options={workspaces.workspaces.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      </div>
      <span className="workspace-role">
        {workspace.role === "OWNER"
          ? "Proprietário"
          : workspace.role === "ADMIN"
            ? "Administrador"
            : "Membro"}
      </span>
      <div className="workspace-tools">
        <Button
          variant="secondary"
          onClick={() =>
            onAction({
              kind: "workspace",
              operation: "create",
              path: "/workspaces",
            })
          }
        >
          Criar workspace
        </Button>
        {canManage(workspace.role) && (
          <ActionMenu label={`Gerenciar workspace ${workspace.name}`}>
            <button
              onClick={() =>
                onAction({
                  kind: "workspace",
                  operation: "rename",
                  path: `/workspaces/${workspace.id}`,
                  name: workspace.name,
                })
              }
            >
              Renomear workspace
            </button>
            {workspace.role === "OWNER" && (
              <button
                className="danger-text"
                onClick={() =>
                  onAction({
                    kind: "workspace",
                    operation: "delete",
                    path: `/workspaces/${workspace.id}`,
                    name: workspace.name,
                  })
                }
              >
                Excluir workspace
              </button>
            )}
          </ActionMenu>
        )}
      </div>
    </div>
  );
}
