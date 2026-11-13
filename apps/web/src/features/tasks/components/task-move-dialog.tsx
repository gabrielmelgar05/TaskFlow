"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { columnTasks } from "../task-utils";
import type { Task } from "../types";
import type { BoardDetail } from "@/features/boards/types";
export function TaskMoveDialog({
  task,
  tasks,
  board,
  busy,
  error,
  move,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  board: BoardDetail;
  busy: boolean;
  error: string;
  onClose: () => void;
  move: (id: string, columnId: string, position: number) => Promise<boolean>;
}) {
  const [columnId, setColumnId] = useState(task.columnId);
  const [position, setPosition] = useState(task.position);
  const sending = useRef(false);
  const prefix = useId();
  const targets = columnTasks(tasks, columnId).filter(
    (item) => item.id !== task.id,
  );
  const max = targets.length;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    try {
      if (await move(task.id, columnId, Math.min(position, max))) onClose();
    } finally {
      sending.current = false;
    }
  }
  return (
    <Dialog
      title="Mover tarefa"
      description={`Escolha a coluna e a posição de “${task.title}”.`}
      busy={busy}
      onClose={onClose}
    >
      <form className="task-form" onSubmit={submit}>
        <div className="form-field">
          <label htmlFor={`${prefix}-column`}>Coluna de destino</label>
          <select
            data-dialog-focus
            id={`${prefix}-column`}
            value={columnId}
            disabled={busy}
            onChange={(event) => {
              setColumnId(event.target.value);
              setPosition(0);
            }}
          >
            {board.columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}-position`}>Posição na coluna</label>
          <select
            id={`${prefix}-position`}
            value={Math.min(position, max)}
            disabled={busy}
            onChange={(event) => setPosition(Number(event.target.value))}
          >
            {Array.from({ length: max + 1 }, (_, index) => (
              <option value={index} key={index}>
                {index === max
                  ? `${index + 1} — Final da coluna`
                  : `${index + 1} — Antes de ${targets[index].title}`}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Movendo…" : "Mover tarefa"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
