"use client";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "./task-card";
import type { Task } from "../types";
export function TaskColumn({
  column,
  tasks,
  busy,
  userId,
  administrator,
  create,
  edit,
  remove,
  move,
}: {
  column: { id: string; name: string; position: number };
  tasks: Task[];
  busy: boolean;
  userId: string;
  administrator: boolean;
  create: () => void;
  edit: (task: Task) => void;
  remove: (task: Task) => void;
  move: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
    disabled: busy,
  });
  return (
    <section
      ref={setNodeRef}
      data-column-id={column.id}
      className={`kanban-column ${isOver ? "kanban-column-over" : ""}`}
      aria-labelledby={`column-${column.id}`}
    >
      <div className="kanban-column-heading">
        <span className="column-dot" aria-hidden="true" />
        <h2 id={`column-${column.id}`}>{column.name}</h2>
        <span className="task-count" aria-label={`${tasks.length} tarefas`}>
          {tasks.length}
        </span>
        <button
          className="task-create"
          aria-label={`Criar tarefa em ${column.name}`}
          disabled={busy}
          onClick={create}
        >
          +
        </button>
      </div>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="task-list" aria-label={`Tarefas em ${column.name}`}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              completed={column.position === 2}
              disabled={busy}
              canDelete={administrator || task.creator.id === userId}
              edit={() => edit(task)}
              remove={() => remove(task)}
              move={() => move(task)}
            />
          ))}
        </ul>
      </SortableContext>
      {!tasks.length && (
        <div className="kanban-empty">
          <p>Nenhuma tarefa</p>
          <button className="text-link" disabled={busy} onClick={create}>
            Criar tarefa
          </button>
        </div>
      )}
    </section>
  );
}
