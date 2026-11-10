"use client";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function ConnectionNotice() {
  const [status, setStatus] = useState<
    "initial" | "checking" | "connected" | "unavailable"
  >("initial");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setStatus("connected");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });
    return () => controller.abort();
  }, [attempt]);
  if (status === "initial" || status === "connected") return null;
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#d9c68b] bg-yellow/40 px-4 py-3 text-sm"
    >
      <Icon name="alert" className="shrink-0" />
      <p className="min-w-0 flex-1 basis-56">
        {status === "checking"
          ? "Verificando a conexão…"
          : "Não foi possível conectar ao serviço. Você pode continuar explorando seu espaço."}
      </p>
      <Button
        disabled={status === "checking"}
        variant="secondary"
        className="min-h-10 px-4 text-xs"
        onClick={() => {
          setStatus("checking");
          setAttempt((value) => value + 1);
        }}
      >
        <Icon name="refresh" width="15" height="15" />{" "}
        {status === "checking" ? "Verificando…" : "Tentar novamente"}
      </Button>
    </div>
  );
}
