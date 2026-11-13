import Link from "next/link";
import type { DashboardBoard } from "@/features/dashboard/types";
import { boardHref } from "./types";
export function BoardsSummary({ boards }: { boards: DashboardBoard[] }) {
  return (
    <ul className="dashboard-boards">
      {boards.map((board) => (
        <li key={board.id}>
          <Link href={boardHref(board.id)} className="dashboard-board-link">
            <span className="resource-name">{board.name}</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <div className="dashboard-board-meta">
            <span>
              {board.totalTasks} {board.totalTasks === 1 ? "tarefa" : "tarefas"}
            </span>
            <span>
              {board.progress === null
                ? "Sem tarefas"
                : `${board.completedTasks} ${board.completedTasks === 1 ? "concluída" : "concluídas"}`}
            </span>
          </div>
          {board.progress !== null && (
            <div className="board-progress">
              <progress
                max={100}
                value={board.progress}
                aria-label={`Progresso de ${board.name}`}
              />
              <span>{board.progress}%</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
