import Link from "next/link";
import { boardHref } from "@/features/boards/types";
import { dueLabel } from "@/features/tasks/task-utils";
import { priorityLabels } from "@/features/tasks/types";
import type { AttentionTask } from "./types";
const reasons = {
  OVERDUE: "Prazo vencido",
  DUE_SOON: "Prazo próximo",
  HIGH_PRIORITY: "Prioridade alta",
};
export function AttentionList({ tasks }: { tasks: AttentionTask[] }) {
  return (
    <ul className="attention-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <div className="attention-heading">
            <span
              className={`attention-reason ${task.reason === "OVERDUE" ? "danger-text" : ""}`}
            >
              {reasons[task.reason]}
            </span>
            <span
              className={`task-priority priority-${task.priority.toLowerCase()}`}
            >
              {priorityLabels[task.priority]}
            </span>
          </div>
          <Link
            href={boardHref(task.board.id, task.id)}
            className="attention-task-link"
          >
            {task.title}
            <span aria-hidden="true">↗</span>
          </Link>
          <div className="attention-meta">
            <span className="resource-name">{task.board.name}</span>
            {task.dueAt ? (
              <time dateTime={task.dueAt.slice(0, 10)}>
                {dueLabel(task.dueAt)}
              </time>
            ) : (
              <span>Sem prazo</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
