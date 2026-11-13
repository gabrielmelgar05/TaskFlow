"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { SessionScreen } from "./session-screen";
export function AuthGate({
  children,
  publicOnly = false,
}: {
  children: ReactNode;
  publicOnly?: boolean;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const redirect = publicOnly
    ? session.status === "authenticated"
    : session.status === "anonymous";
  useEffect(() => {
    if (redirect) router.replace(publicOnly ? "/" : "/login/");
  }, [redirect, publicOnly, router]);
  if (session.status === "unavailable") return <SessionScreen unavailable />;
  if (session.status === "checking" || redirect) return <SessionScreen />;
  return children;
}
