"use client";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSessionRequest } from "@/hooks/use-api-resource";
import type { Task } from "../types";
export function TaskDeleteDialog({
  task,
  onClose,
  onDeleted,
}: {
  task: Task;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const request = useSessionRequest();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  async function remove() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await request<void>(`/tasks/${task.id}`, { method: "DELETE" });
      onDeleted();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a tarefa.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Excluir tarefa"
      description={`Excluir a tarefa “${task.title}”? Esta ação não pode ser desfeita.`}
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="form-alert mt-5">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button
          data-dialog-focus
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          className="button-danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? "Excluindo…" : "Excluir tarefa"}
        </Button>
      </div>
    </Dialog>
  );
}
