"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { useApiResource } from "@/hooks/use-api-resource";
import { ResourceError, ResourceLoading } from "./resource-state";
import type { BoardDetail } from "./types";

export function BoardScreen() {
  const id = useSearchParams().get("id");
  const resource = useApiResource<BoardDetail>(
    id ? `/boards/${encodeURIComponent(id)}` : null,
  );
  const board = resource.data;
  useEffect(() => {
    if (board) document.title = `${board.name} | TaskFlow`;
    return () => {
      document.title = "Quadro | TaskFlow";
    };
  }, [board]);
  return (
    <>
      <ButtonLink variant="secondary" href="/quadros/">
        ← Voltar aos quadros
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
            <div className="kanban-grid" aria-label="Colunas do quadro">
              {board.columns.map((column) => (
                <section
                  key={column.id}
                  className="kanban-column"
                  aria-labelledby={`column-${column.id}`}
                >
                  <div className="kanban-column-heading">
                    <span className="column-dot" aria-hidden="true" />
                    <h2 id={`column-${column.id}`}>{column.name}</h2>
                  </div>
                  <div className="kanban-empty">
                    <p>Nenhuma tarefa</p>
                  </div>
                </section>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
