"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useApiResource, useSessionRequest } from "@/hooks/use-api-resource";
import { ApiError } from "@/lib/api";
import { validateTask } from "../task-utils";
import {
  priorityLabels,
  type Person,
  type Priority,
  type Task,
  type TaskInput,
} from "../types";
import type { BoardDetail } from "@/features/boards/types";

export function TaskForm({
  board,
  columnId,
  task,
  onClose,
  onSaved,
}: {
  board: BoardDetail;
  columnId: string;
  task?: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const request = useSessionRequest();
  const members = useApiResource<Person[]>(
    `/workspaces/${board.workspaceId}/members`,
  );
  const [input, setInput] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "MEDIUM",
    dueAt: task?.dueAt?.slice(0, 10) ?? "",
    assigneeId: task?.assignee?.id ?? "",
  });
  const [selectedColumn, setSelectedColumn] = useState(columnId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const id = (name: string) => `${prefix}-${name}`;
  function update<K extends keyof TaskInput>(name: K, value: TaskInput[K]) {
    setInput((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }
  function focusError(fields: Record<string, string>) {
    const first = Object.keys(fields)[0];
    form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    const fields = validateTask(input);
    if (Object.keys(fields).length) {
      setErrors(fields);
      focusError(fields);
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      const body = {
        ...input,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueAt: input.dueAt || null,
        assigneeId: input.assigneeId || null,
        ...(task ? {} : { columnId: selectedColumn }),
      };
      const saved = await request<Task>(
        task ? `/tasks/${task.id}` : `/boards/${board.id}/tasks`,
        { method: task ? "PATCH" : "POST", body },
      );
      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a tarefa.",
      );
      if (error instanceof ApiError) {
        setErrors(error.fields);
        requestAnimationFrame(() => focusError(error.fields));
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" id={`${id(name)}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;
  const access = (name: string) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${id(name)}-error` : undefined,
  });
  const currentAssigneeMissing =
    task?.assignee &&
    members.data &&
    !members.data.some((person) => person.id === task.assignee?.id);
  return (
    <Dialog
      title={task ? "Editar tarefa" : "Criar tarefa"}
      description={
        task
          ? "Atualize os detalhes. Para mudar a coluna, use Mover tarefa ou arraste o cartão."
          : "Defina o próximo passo do seu projeto."
      }
      busy={busy}
      onClose={onClose}
    >
      <form
        ref={form}
        onSubmit={submit}
        noValidate
        aria-busy={busy}
        className="task-form"
      >
        <div className="form-field">
          <label htmlFor={id("title")}>Título</label>
          <input
            data-dialog-focus
            id={id("title")}
            name="title"
            required
            maxLength={200}
            value={input.title}
            disabled={busy}
            onChange={(event) => update("title", event.target.value)}
            {...access("title")}
          />
          {error("title")}
        </div>
        <div className="form-field">
          <label htmlFor={id("description")}>
            Descrição <span className="optional-label">(opcional)</span>
          </label>
          <textarea
            id={id("description")}
            name="description"
            rows={4}
            maxLength={5000}
            value={input.description ?? ""}
            disabled={busy}
            onChange={(event) => update("description", event.target.value)}
            {...access("description")}
          />
          {error("description")}
        </div>
        <div className="task-form-row">
          <div className="form-field">
            <label htmlFor={id("priority")}>Prioridade</label>
            <Select
              id={id("priority")}
              name="priority"
              value={input.priority}
              disabled={busy}
              onValueChange={(value) => update("priority", value as Priority)}
              options={Object.entries(priorityLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              {...access("priority")}
            />
            {error("priority")}
          </div>
          <div className="form-field">
            <label htmlFor={id("dueAt")}>
              Prazo <span className="optional-label">(opcional)</span>
            </label>
            <input
              type="date"
              id={id("dueAt")}
              name="dueAt"
              value={input.dueAt ?? ""}
              disabled={busy}
              onChange={(event) => update("dueAt", event.target.value)}
              {...access("dueAt")}
            />
            {error("dueAt")}
          </div>
        </div>
        <div className="form-field">
          <label htmlFor={id("assigneeId")}>
            Responsável <span className="optional-label">(opcional)</span>
          </label>
          <Select
            id={id("assigneeId")}
            name="assigneeId"
            value={input.assigneeId ?? ""}
            disabled={busy || members.loading || !!members.error}
            onValueChange={(value) => update("assigneeId", value)}
            options={[
              { value: "", label: "Sem responsável" },
              ...(members.data ?? []).map((person) => ({
                value: person.id,
                label: person.name,
              })),
              ...(currentAssigneeMissing && task?.assignee
                ? [
                    {
                      value: task.assignee.id,
                      label: `${task.assignee.name} (fora do workspace)`,
                    },
                  ]
                : []),
            ]}
            {...access("assigneeId")}
          />
          {error("assigneeId")}
          {members.loading ? (
            <p className="field-hint" role="status">
              Carregando responsáveis…
            </p>
          ) : members.error ? (
            <div className="field-error">
              <p role="alert">{members.error}</p>
              <button
                type="button"
                className="text-link"
                onClick={members.reload}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            members.data?.length === 1 && (
              <p className="field-hint">
                Só você participa deste workspace. Você pode assumir a tarefa ou
                deixá-la sem responsável.
              </p>
            )
          )}
        </div>
        {!task && (
          <div className="form-field">
            <label htmlFor={id("columnId")}>Coluna</label>
            <Select
              id={id("columnId")}
              name="columnId"
              value={selectedColumn}
              disabled={busy}
              onValueChange={setSelectedColumn}
              options={board.columns.map((column) => ({
                value: column.id,
                label: column.name,
              }))}
              {...access("columnId")}
            />
            {error("columnId")}
          </div>
        )}
        {message && (
          <p className="form-alert" role="alert">
            {message}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={busy || members.loading || !!members.error}
          >
            {busy ? "Salvando…" : task ? "Salvar alterações" : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
