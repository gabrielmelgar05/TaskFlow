import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspacesProvider } from "@/features/workspaces/workspaces-provider";
export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <WorkspacesProvider>
        <AppShell>{children}</AppShell>
      </WorkspacesProvider>
    </AuthGate>
  );
}
