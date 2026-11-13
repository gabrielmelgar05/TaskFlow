"use client";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Icon } from "@/components/ui/icon";
import { BoardsSummary } from "@/features/boards/boards-summary";
import {
  ResourceDialog,
  type ResourceAction,
} from "@/features/boards/resource-dialog";
import {
  ResourceError,
  ResourceLoading,
} from "@/features/boards/resource-state";
import { WorkspaceToolbar } from "@/features/workspaces/workspace-toolbar";
import {
  useWorkspaces,
  canManage,
} from "@/features/workspaces/workspaces-provider";
import { TaskSummary } from "@/features/tasks/components/task-summary";
import { localDateString } from "@/features/tasks/task-utils";
import { useApiResource } from "@/hooks/use-api-resource";
import { AttentionList } from "./attention-list";
import type { DashboardSummary } from "./types";

export function DashboardScreen() {
  const workspaces = useWorkspaces();
  const workspace = workspaces.selected;
  const dashboard = useApiResource<DashboardSummary>(
    workspace
      ? `/dashboard/summary?workspaceId=${encodeURIComponent(workspace.id)}&today=${localDateString()}`
      : null,
  );
  const [action, setAction] = useState<ResourceAction | null>(null);
  const [notice, setNotice] = useState("");
  const { reload } = dashboard;
  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);
  function saved(result?: { id: string }) {
    if (action?.operation === "create" && result) workspaces.select(result.id);
    setNotice(
      action?.operation === "create"
        ? "Workspace criado com sucesso."
        : action?.operation === "delete"
          ? "Workspace excluído com sucesso."
          : "Workspace renomeado com sucesso.",
    );
    workspaces.reload();
    dashboard.reload();
    setAction(null);
  }
  const data = dashboard.data;
  return (
    <>
      <div className="page-heading boards-heading">
        <div>
          <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
          <h1>
            Visão geral<span className="text-[#9a6c8d]">.</span>
          </h1>
          <p>Acompanhe seus projetos e escolha o próximo passo.</p>
        </div>
        {workspace && (
          <ButtonLink href="/quadros/" variant="secondary">
            Abrir Quadros
            <Icon name="arrow" width="16" height="16" />
          </ButtonLink>
        )}
      </div>
      {notice && (
        <p role="status" className="success-notice">
          {notice}
        </p>
      )}
      {workspaces.loading ? (
        <ResourceLoading />
      ) : workspaces.error ? (
        <ResourceError message={workspaces.error} retry={workspaces.reload} />
      ) : !workspace ? (
        <SectionCard title="Seu próximo projeto começa aqui">
          <EmptyState
            spacious
            title="Organize seus projetos em um só lugar"
            description="Crie seu primeiro espaço de trabalho para reunir seus quadros e acompanhar suas tarefas."
          >
            <Button
              onClick={() =>
                setAction({
                  kind: "workspace",
                  operation: "create",
                  path: "/workspaces",
                })
              }
            >
              Criar workspace
            </Button>
          </EmptyState>
        </SectionCard>
      ) : (
        <>
          <WorkspaceToolbar
            onAction={setAction}
            onSelect={() => setNotice("")}
          />
          {dashboard.loading ? (
            <ResourceLoading label="Carregando a visão geral…" />
          ) : dashboard.error ? (
            <ResourceError message={dashboard.error} retry={dashboard.reload} />
          ) : (
            data && (
              <>
                <TaskSummary metrics={data.metrics} />
                {!data.boards.length ? (
                  <SectionCard title="Seus quadros">
                    <EmptyState
                      title="Um workspace, muitas possibilidades"
                      description={
                        canManage(workspace.role)
                          ? "Crie seu primeiro quadro para começar a organizar o trabalho."
                          : "Os quadros compartilhados com você aparecerão aqui."
                      }
                    >
                      <ButtonLink href="/quadros/">Abrir Quadros</ButtonLink>
                    </EmptyState>
                  </SectionCard>
                ) : (
                  <div className="dashboard-content">
                    <SectionCard
                      title="Precisa de atenção"
                      description="Prazos e prioridades para orientar seu próximo passo."
                    >
                      {data.attention.length ? (
                        <AttentionList tasks={data.attention} />
                      ) : (
                        <EmptyState
                          title={
                            data.metrics.total
                              ? "Tudo em dia por aqui"
                              : "Tudo começa com uma tarefa"
                          }
                          description={
                            data.metrics.total
                              ? "Nenhuma tarefa com prazo próximo, vencido ou prioridade alta neste workspace."
                              : "Abra um quadro e crie sua primeira tarefa para começar."
                          }
                        >
                          <ButtonLink href="/quadros/" variant="secondary">
                            Abrir Quadros
                          </ButtonLink>
                        </EmptyState>
                      )}
                    </SectionCard>
                    <SectionCard
                      title="Seus quadros"
                      description="Progresso a partir das tarefas concluídas."
                    >
                      <BoardsSummary boards={data.boards} />
                    </SectionCard>
                  </div>
                )}
              </>
            )
          )}
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
