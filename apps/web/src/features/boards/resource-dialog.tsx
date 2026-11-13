"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSessionRequest } from "@/hooks/use-api-resource";
import { ApiError } from "@/lib/api";
import { validateResourceName } from "@/lib/resource-validation";

export interface ResourceAction {
  kind: "workspace" | "board";
  operation: "create" | "rename" | "delete";
  path: string;
  name?: string;
}
export function ResourceDialog({
  action,
  onClose,
  onSaved,
}: {
  action: ResourceAction;
  onClose: () => void;
  onSaved: (result?: { id: string }) => void;
}) {
  const request = useSessionRequest();
  const [name, setName] = useState(action.name ?? "");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const label = action.kind === "workspace" ? "workspace" : "quadro";
  const deleting = action.operation === "delete";
  const verb = deleting
    ? "Excluir"
    : action.operation === "create"
      ? "Criar"
      : "Renomear";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    const invalid = deleting ? undefined : validateResourceName(name);
    if (invalid) {
      setFieldError(invalid);
      input.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setFieldError(undefined);
    try {
      const result = await request<{ id: string } | undefined>(action.path, {
        method: deleting
          ? "DELETE"
          : action.operation === "create"
            ? "POST"
            : "PATCH",
        body: deleting
          ? undefined
          : { name: name.trim().replace(/ {2,}/g, " ") },
      });
      onSaved(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Tente novamente.",
      );
      if (error instanceof ApiError && error.fields.name) {
        setFieldError(error.fields.name);
        requestAnimationFrame(() => input.current?.focus());
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const description = deleting
    ? action.kind === "workspace"
      ? `Excluir o workspace “${action.name}” também excluirá todos os seus quadros e conteúdos relacionados. Esta ação não pode ser desfeita.`
      : `Excluir o quadro “${action.name}” também removerá suas colunas e conteúdos relacionados. Esta ação não pode ser desfeita.`
    : action.operation === "create"
      ? action.kind === "workspace"
        ? "Dê um nome ao espaço que vai reunir seus projetos."
        : "Seu quadro começará com as colunas A fazer, Em andamento e Concluído."
      : `Escolha um novo nome para ${action.kind === "workspace" ? "o workspace" : "o quadro"}.`;
  return (
    <Dialog
      title={`${verb} ${label}`}
      description={description}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate aria-busy={busy}>
        {!deleting && (
          <div className="form-field mt-6">
            <label htmlFor={id}>
              {action.kind === "workspace"
                ? "Nome do workspace"
                : "Nome do quadro"}
            </label>
            <input
              ref={input}
              id={id}
              data-dialog-focus
              required
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError(undefined);
              }}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? `${id}-error` : `${id}-hint`}
            />
            {fieldError ? (
              <p id={`${id}-error`} className="field-error" role="alert">
                {fieldError}
              </p>
            ) : (
              <p id={`${id}-hint`} className="field-hint">
                De 1 a 100 caracteres.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="form-alert mt-5">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            data-dialog-focus={deleting || undefined}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className={deleting ? "button-danger" : ""}
            disabled={busy}
          >
            {busy ? "Aguarde…" : `${verb} ${label}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
