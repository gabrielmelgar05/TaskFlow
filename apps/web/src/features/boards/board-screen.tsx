"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { useApiResource } from "@/hooks/use-api-resource";
import { ResourceError, ResourceLoading } from "./resource-state";
import type { BoardDetail } from "./types";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { useWorkspaces } from "@/features/workspaces/workspaces-provider";

export function BoardScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { select } = useWorkspaces();
  const resource = useApiResource<BoardDetail>(
    id ? `/boards/${encodeURIComponent(id)}` : null,
  );
  const board = resource.data;
  useEffect(() => {
    if (board) {
      document.title = `${board.name} | TaskFlow`;
      select(board.workspaceId);
    }
    return () => {
      document.title = "Quadro | TaskFlow";
    };
  }, [board, select]);
  return (
    <>
      <ButtonLink variant="secondary" href="/quadros/">
        Voltar aos quadros
      </ButtonLink>
      {!id ? (
        <p className="resource-error" role="alert">
          Selecione um quadro na listagem para continuar.
        </p>
      ) : resource.loading ? (
        <ResourceLoading label="Carregando quadro…" />
      ) : resource.error ? (
        <ResourceError message={resource.error} retry={resource.reload} />
      ) : (
        board && (
          <>
            <div className="page-heading mt-7">
              <div>
                <p className="eyebrow resource-name">{board.workspace.name}</p>
                <h1 className="resource-name">{board.name}</h1>
                <p>Um passo de cada vez, do começo à conclusão.</p>
              </div>
            </div>
            <TaskBoard
              key={board.id}
              board={board}
              initialTaskId={params.get("task")}
            />
          </>
        )
      )}
    </>
  );
}
