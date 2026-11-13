import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthGate } from "@/components/auth/auth-gate";
export const metadata: Metadata = { title: "Criar conta | TaskFlow" };
export default function RegisterPage() {
  return (
    <AuthGate publicOnly>
      <AuthForm mode="register" />
    </AuthGate>
  );
}
