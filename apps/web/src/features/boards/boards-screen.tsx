"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { SectionCard } from "@/components/ui/section-card";
import { ActionMenu } from "@/components/ui/action-menu";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  canManage,
  useWorkspaces,
} from "@/features/workspaces/workspaces-provider";
import { ResourceDialog, type ResourceAction } from "./resource-dialog";
import { ResourceLoading, ResourceError } from "./resource-state";
import { boardHref, type Board } from "./types";

export function BoardsScreen() {
  const workspaces = useWorkspaces();
  const workspace = workspaces.selected;
  const boards = useApiResource<Board[]>(
    workspace ? `/workspaces/${encodeURIComponent(workspace.id)}/boards` : null,
  );
  const [action, setAction] = useState<ResourceAction | null>(null);
  const [notice, setNotice] = useState("");
  const manageable = canManage(workspace?.role);
  const createWorkspace = () =>
    setAction({ kind: "workspace", operation: "create", path: "/workspaces" });
  const createBoard = () => {
    if (workspace)
      setAction({
        kind: "board",
        operation: "create",
        path: `/workspaces/${workspace.id}/boards`,
      });
  };
  function saved(result?: { id: string }) {
    if (!action) return;
    const label = action.kind === "workspace" ? "Workspace" : "Quadro";
    setNotice(
      `${label} ${action.operation === "create" ? "criado" : action.operation === "rename" ? "renomeado" : "excluído"} com sucesso.`,
    );
    if (action.kind === "workspace") {
      if (action.operation === "create" && result) workspaces.select(result.id);
      workspaces.reload();
    } else boards.reload();
    setAction(null);
  }
  return (
    <>
      <div className="page-heading boards-heading">
        <div>
          <p className="eyebrow">IDEIAS GANHAM ESPAÇO AQUI</p>
          <h1>
            Quadros<span className="text-[#9a6c8d]">.</span>
          </h1>
          <p>
            Um lugar para organizar seus projetos, do começo ao próximo passo.
          </p>
        </div>
        {workspace && manageable && (
          <Button onClick={createBoard}>
            Criar quadro <Icon name="arrow" width="16" height="16" />
          </Button>
        )}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {workspaces.loading ? (
        <ResourceLoading />
      ) : workspaces.error ? (
        <ResourceError message={workspaces.error} retry={workspaces.reload} />
      ) : !workspace ? (
        <SectionCard title="Seus espaços de trabalho">
          <EmptyState
            spacious
            title="Organize seus projetos em um só lugar"
            description="Crie seu primeiro espaço de trabalho para começar a organizar seus quadros."
          >
            <Button onClick={createWorkspace}>Criar workspace</Button>
          </EmptyState>
        </SectionCard>
      ) : (
        <>
          <div className="workspace-toolbar">
            <div className="workspace-selector">
              <label htmlFor="workspace-selection">Workspace atual</label>
              <select
                id="workspace-selection"
                value={workspace.id}
                onChange={(event) => {
                  workspaces.select(event.target.value);
                  setNotice("");
                }}
              >
                {workspaces.workspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="workspace-role">
              {workspace.role === "OWNER"
                ? "Proprietário"
                : workspace.role === "ADMIN"
                  ? "Administrador"
                  : "Somente leitura"}
            </span>
            <div className="workspace-tools">
              <Button variant="secondary" onClick={createWorkspace}>
                Criar workspace
              </Button>
              {manageable && (
                <ActionMenu label={`Gerenciar workspace ${workspace.name}`}>
                  <button
                    onClick={() =>
                      setAction({
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
                        setAction({
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
          <SectionCard
            title="Meus quadros"
            description={`Projetos de ${workspace.name}`}
          >
            {boards.loading ? (
              <ResourceLoading label="Carregando quadros…" />
            ) : boards.error ? (
              <ResourceError
                message={boards.error}
                retry={() => {
                  boards.reload();
                  workspaces.reload();
                }}
              />
            ) : !boards.data?.length ? (
              <EmptyState
                spacious
                title="Nenhum quadro por aqui"
                description={
                  manageable
                    ? "Crie um quadro para começar a organizar seu projeto."
                    : "Os quadros deste workspace aparecerão aqui. Você tem acesso de leitura."
                }
              >
                {manageable && (
                  <Button onClick={createBoard}>Criar quadro</Button>
                )}
              </EmptyState>
            ) : (
              <div className="boards-grid">
                {boards.data.map((board) => (
                  <article className="board-card" key={board.id}>
                    <div className="board-card-top">
                      <span className="board-symbol">
                        <Icon name="boards" />
                      </span>
                      {manageable && (
                        <ActionMenu label={`Ações do quadro ${board.name}`}>
                          <button
                            onClick={() =>
                              setAction({
                                kind: "board",
                                operation: "rename",
                                path: `/boards/${board.id}`,
                                name: board.name,
                              })
                            }
                          >
                            Renomear quadro
                          </button>
                          <button
                            className="danger-text"
                            onClick={() =>
                              setAction({
                                kind: "board",
                                operation: "delete",
                                path: `/boards/${board.id}`,
                                name: board.name,
                              })
                            }
                          >
                            Excluir quadro
                          </button>
                        </ActionMenu>
                      )}
                    </div>
                    <h3>
                      <Link href={boardHref(board.id)}>{board.name}</Link>
                    </h3>
                    <p>
                      Criado em{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(board.createdAt))}
                    </p>
                    <Link className="board-open" href={boardHref(board.id)}>
                      Abrir quadro <Icon name="arrow" width="16" height="16" />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
      {action && (
        <ResourceDialog
          action={action}
          onClose={() => setAction(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
