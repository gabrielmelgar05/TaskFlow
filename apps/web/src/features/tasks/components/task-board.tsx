"use client";
import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAuth } from "@/components/auth/auth-provider";
import { useApiResource, useSessionRequest } from "@/hooks/use-api-resource";
import { canManage } from "@/features/workspaces/workspaces-provider";
import {
  ResourceError,
  ResourceLoading,
} from "@/features/boards/resource-state";
import type { BoardDetail } from "@/features/boards/types";
import { columnTasks, moveTaskLocally, removeTaskLocally } from "../task-utils";
import type { Task } from "../types";
import { TaskColumn } from "./task-column";
import { TaskForm } from "./task-form";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskMoveDialog } from "./task-move-dialog";

type DialogState =
  | { kind: "create"; columnId: string }
  | { kind: "edit" | "delete" | "move"; task: Task };
const collisions: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter(
    (hit) =>
      args.droppableContainers.find((container) => container.id === hit.id)
        ?.data.current?.type === "task",
  );
  return cards.length ? cards : hits.length ? hits : closestCorners(args);
};
export function TaskBoard({
  board,
  initialTaskId,
}: {
  board: BoardDetail;
  initialTaskId?: string | null;
}) {
  const resource = useApiResource<Task[]>(`/boards/${board.id}/tasks`);
  const request = useSessionRequest();
  const { session } = useAuth();
  const tasks = resource.data ?? [];
  const [manualDialog, setDialog] = useState<DialogState | null>(null);
  const [dismissedTaskId, setDismissedTaskId] = useState<string | null>(null);
  const linkedTask =
    initialTaskId && initialTaskId !== dismissedTaskId
      ? tasks.find((task) => task.id === initialTaskId)
      : undefined;
  const dialog: DialogState | null =
    manualDialog ?? (linkedTask ? { kind: "edit", task: linkedTask } : null);
  function closeDialog() {
    setDialog(null);
    setDismissedTaskId(initialTaskId ?? null);
  }

  const [active, setActive] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  function open(state: DialogState) {
    setError("");
    setNotice("");
    setDialog(state);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "auto",
    }),
  );
  async function move(id: string, columnId: string, position: number) {
    if (sending.current) return false;
    const task = tasks.find((item) => item.id === id);
    if (!task || !board.columns.some((column) => column.id === columnId))
      return false;
    if (task.columnId === columnId && task.position === position) return true;
    sending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const snapshot = tasks;
    resource.replace(moveTaskLocally(tasks, id, columnId, position));
    try {
      const confirmed = await request<Task[]>(`/tasks/${id}/move`, {
        method: "PATCH",
        body: { columnId, position },
      });
      resource.replace(confirmed);
      setNotice("Tarefa movida com sucesso.");
      return true;
    } catch (error) {
      resource.replace(snapshot);
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível mover a tarefa. Tente novamente.",
      );
      // Se a resposta se perdeu depois do commit, uma leitura reconcilia a
      // interface com o banco. Se a rede continuar fora, o snapshot permanece.
      try {
        resource.replace(
          await request<Task[]>(`/boards/${board.id}/tasks`, {
            signal: AbortSignal.timeout(4000),
          }),
        );
      } catch {
        /* O aviso permanece e permite atualizar/tentar novamente. */
      }
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function dragEnd(event: DragEndEvent) {
    setActive(null);
    if (!event.over) return;
    const task = tasks.find((item) => item.id === event.active.id);
    const columnId = event.over.data.current?.columnId as string | undefined;
    if (
      !task ||
      !columnId ||
      !board.columns.some((column) => column.id === columnId)
    )
      return;
    const target = columnTasks(tasks, columnId).filter(
      (item) => item.id !== task.id,
    );
    const overIndex = target.findIndex((item) => item.id === event.over?.id);
    let position = overIndex < 0 ? target.length : overIndex;
    if (overIndex >= 0 && task.columnId === columnId) {
      // Na mesma coluna, o índice original do cartão alvo dá o destino final.
      position = columnTasks(tasks, columnId).findIndex(
        (item) => item.id === event.over?.id,
      );
    } else if (
      overIndex >= 0 &&
      event.active.rect.current.translated &&
      event.active.rect.current.translated.top >
        event.over.rect.top + event.over.rect.height / 2
    )
      position += 1;
    if (event.over.id === task.id) return;
    void move(task.id, columnId, position);
  }
  function saved(task: Task) {
    resource.replace(
      tasks.some((item) => item.id === task.id)
        ? tasks.map((item) => (item.id === task.id ? task : item))
        : [...tasks, task],
    );
    setNotice(
      dialog?.kind === "create"
        ? "Tarefa criada com sucesso."
        : "Tarefa atualizada com sucesso.",
    );
    setError("");
    closeDialog();
  }
  if (resource.loading) return <ResourceLoading label="Carregando tarefas…" />;
  if (resource.error)
    return <ResourceError message={resource.error} retry={resource.reload} />;
  return (
    <>
      {initialTaskId && initialTaskId !== dismissedTaskId && !linkedTask && (
        <p className="form-alert mb-5" role="status">
          A tarefa solicitada não está disponível neste quadro.
        </p>
      )}
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {error && !dialog && (
        <p role="alert" className="form-alert mb-5">
          {error}
        </p>
      )}
      <p className="kanban-help">
        Arraste pela alça ⠿ para organizar as tarefas entre colunas. Você também
        pode usar Mover tarefa no menu de cada cartão.
      </p>
      {busy && (
        <p role="status" className="field-hint mb-3">
          Salvando movimentação…
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisions}
        onDragStart={({ active }) => {
          setActive(tasks.find((task) => task.id === active.id) ?? null);
          setNotice("");
          setError("");
        }}
        onDragCancel={() => {
          setActive(null);
          setNotice("Movimentação cancelada.");
        }}
        onDragEnd={dragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Para arrastar, pressione Espaço. Use as setas para mover, Espaço para soltar e Escape para cancelar. Você também pode usar a ação Mover tarefa.",
          },
          announcements: {
            onDragStart: ({ active }) =>
              `Tarefa ${active.data.current?.title ?? ""} selecionada.`,
            onDragOver: ({ over }) =>
              over
                ? "Destino selecionado. Solte para mover."
                : "Fora de uma coluna.",
            onDragEnd: ({ over }) =>
              over
                ? "Arrasto concluído. A movimentação será salva."
                : "Movimentação cancelada.",
            onDragCancel: () =>
              "Movimentação cancelada. Nenhuma alteração foi salva.",
          },
        }}
      >
        <div
          className="kanban-region"
          role="region"
          aria-label="Colunas do quadro"
          tabIndex={0}
        >
          <div className="kanban-grid" aria-busy={busy}>
            {board.columns.map((column) => (
              <TaskColumn
                key={column.id}
                column={column}
                tasks={columnTasks(tasks, column.id)}
                busy={busy}
                userId={session.user?.id ?? ""}
                administrator={canManage(board.workspace.role)}
                create={() => open({ kind: "create", columnId: column.id })}
                edit={(task) => open({ kind: "edit", task })}
                remove={(task) => open({ kind: "delete", task })}
                move={(task) => open({ kind: "move", task })}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="task-drag-preview">{active.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <TaskForm
          board={board}
          columnId={
            dialog.kind === "create" ? dialog.columnId : dialog.task.columnId
          }
          task={dialog.kind === "edit" ? dialog.task : undefined}
          onClose={closeDialog}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "delete" && (
        <TaskDeleteDialog
          task={dialog.task}
          onClose={closeDialog}
          onDeleted={() => {
            resource.replace(removeTaskLocally(tasks, dialog.task));
            closeDialog();
            setNotice("Tarefa excluída com sucesso.");
          }}
        />
      )}
      {dialog?.kind === "move" && (
        <TaskMoveDialog
          task={dialog.task}
          tasks={tasks}
          board={board}
          busy={busy}
          error={error}
          move={move}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
