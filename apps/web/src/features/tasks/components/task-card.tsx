"use client";
import { useSortable } from "@dnd-kit/sortable";
import { ActionMenu } from "@/components/ui/action-menu";
import { dueLabel, isOverdue } from "../task-utils";
import { priorityLabels, type Task } from "../types";
export function TaskCard({
  task,
  disabled,
  canDelete,
  completed,
  edit,
  remove,
  move,
}: {
  task: Task;
  disabled: boolean;
  canDelete: boolean;
  completed: boolean;
  edit: () => void;
  remove: () => void;
  move: () => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", columnId: task.columnId, title: task.title },
    disabled,
  });
  const overdue = isOverdue(task, completed);
  return (
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      className={`task-card ${isDragging ? "task-card-dragging" : ""}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
          : undefined,
        transition: transition,
      }}
    >
      <div className="task-card-toolbar">
        <span
          className={`task-priority priority-${task.priority.toLowerCase()}`}
        >
          {priorityLabels[task.priority]}
        </span>
        <div className="task-card-actions">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="task-drag-handle"
            aria-label={`Arrastar tarefa ${task.title}`}
            disabled={disabled}
          >
            ⠿
          </button>
          <ActionMenu label={`Ações da tarefa ${task.title}`}>
            <button disabled={disabled} onClick={edit}>
              Editar tarefa
            </button>
            <button disabled={disabled} onClick={move}>
              Mover tarefa
            </button>
            {canDelete && (
              <button
                disabled={disabled}
                className="danger-text"
                onClick={remove}
              >
                Excluir tarefa
              </button>
            )}
          </ActionMenu>
        </div>
      </div>
      <h3>
        <button
          className="task-title"
          disabled={disabled}
          onClick={edit}
          aria-label={`Abrir tarefa ${task.title}`}
        >
          {task.title}
        </button>
      </h3>
      {(task.assignee || task.dueAt) && (
        <div className="task-card-meta">
          {task.assignee && (
            <span
              className="task-assignee"
              title={`Responsável: ${task.assignee.name}`}
            >
              <span aria-hidden="true">
                {task.assignee.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="task-assignee-name">{task.assignee.name}</span>
            </span>
          )}
          {task.dueAt && (
            <span className={overdue ? "task-due task-overdue" : "task-due"}>
              <time dateTime={task.dueAt.slice(0, 10)}>
                {dueLabel(task.dueAt)}
              </time>
              {overdue && <span>Em atraso</span>}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
