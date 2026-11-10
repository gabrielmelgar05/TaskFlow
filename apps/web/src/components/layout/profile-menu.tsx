"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
export function ProfileMenu() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const details = useRef<HTMLDetailsElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !details.current?.contains(event.target) &&
        details.current
      )
        details.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  if (session.status !== "authenticated") return null;
  const user = session.user;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await logout();
      router.replace("/login/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível sair. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details
      ref={details}
      className="profile-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={`Conta de ${user.name}`}>
        <span className="profile-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="profile-name">{user.name.split(" ")[0]}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="profile-popover">
        <p className="font-medium text-sm break-words">{user.name}</p>
        <p className="mt-1 text-xs text-muted break-all">{user.email}</p>
        <div className="mt-4 border-t border-line pt-3">
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => {
              void signOut();
            }}
          >
            {pending ? "Saindo…" : "Sair da conta"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="field-error mt-3">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
