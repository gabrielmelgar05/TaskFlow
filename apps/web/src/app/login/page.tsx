import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthGate } from "@/components/auth/auth-gate";
export const metadata: Metadata = { title: "Entrar | TaskFlow" };
export default function LoginPage() {
  return (
    <AuthGate publicOnly>
      <AuthForm mode="login" />
    </AuthGate>
  );
}
