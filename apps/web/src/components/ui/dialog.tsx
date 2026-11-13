"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export function Dialog({
  title,
  description,
  children,
  busy,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-focus]")?.focus();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
      else document.querySelector<HTMLElement>("#conteudo")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="resource-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])",
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="secondary"
          className="dialog-close"
          aria-label="Fechar diálogo"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      <p id={descriptionId} className="dialog-description">
        {description}
      </p>
      {children}
    </dialog>
  );
}
