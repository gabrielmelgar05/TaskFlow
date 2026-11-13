"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, apiRequest } from "@/lib/api";

export function useSessionRequest() {
  const { expireSession } = useAuth();
  return useCallback(
    async <T>(...args: Parameters<typeof apiRequest<T>>) => {
      try {
        return await apiRequest<T>(...args);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) expireSession();
        throw error;
      }
    },
    [expireSession],
  );
}

// Cada consulta tem sua chave e AbortController: alternar workspaces nunca
// mostra uma resposta atrasada do workspace anterior.
export function useApiResource<T>(path: string | null) {
  const request = useSessionRequest();
  const [attempt, setAttempt] = useState(0);
  const key = `${path}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    request<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar os dados.",
          });
      },
    );
    return () => controller.abort();
  }, [path, key, request]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const replace = useCallback((data: T) => setResult({ key, data }), [key]);
  return {
    data: path && result.key === key ? result.data : undefined,
    error: path && result.key === key ? result.error : undefined,
    loading: !!path && result.key !== key,
    reload,
    replace,
  };
}
