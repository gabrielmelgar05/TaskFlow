"use client";
import { useApiResource } from "@/hooks/use-api-resource";
import { localDateString } from "../task-utils";
import type { TaskSummary as Summary } from "../types";
export function TaskSummary() {
  const resource = useApiResource<Summary>(
    `/tasks/summary?today=${localDateString()}`,
  );
  return (
    <div className="task-summary" aria-label="Resumo das tarefas acessíveis">
      {resource.loading ? (
        <p role="status">Carregando resumo das tarefas…</p>
      ) : resource.error ? (
        <p role="alert">
          {resource.error}{" "}
          <button className="text-link" onClick={resource.reload}>
            Tentar novamente
          </button>
        </p>
      ) : (
        resource.data && (
          <dl>
            <div>
              <dt>Total de tarefas</dt>
              <dd>{resource.data.total}</dd>
            </div>
            <div>
              <dt>Em andamento</dt>
              <dd>{resource.data.inProgress}</dd>
            </div>
            <div>
              <dt>Concluídas</dt>
              <dd>{resource.data.completed}</dd>
            </div>
            <div>
              <dt>Em atraso</dt>
              <dd>{resource.data.overdue}</dd>
            </div>
          </dl>
        )
      )}
    </div>
  );
}
