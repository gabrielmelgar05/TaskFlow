"use client";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "./auth-provider";
export function SessionScreen({
  unavailable = false,
}: {
  unavailable?: boolean;
}) {
  const { retry } = useAuth();
  return (
    <main className="session-screen">
      <Brand />
      <div role="status" className="mt-10 max-w-sm text-center">
        {unavailable ? (
          <>
            <div className="mb-4 flex justify-center text-muted">
              <Icon name="alert" width="28" height="28" />
            </div>
            <h1 className="text-xl font-medium">
              Não foi possível verificar sua sessão
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              O serviço está indisponível no momento. Tente novamente para
              acessar sua conta.
            </p>
            <Button className="mt-6" onClick={retry}>
              <Icon name="refresh" width="16" height="16" />
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <span className="loading-ring" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">Verificando sua sessão…</p>
          </>
        )}
      </div>
    </main>
  );
}
