"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ConnectionNotice } from "./connection-notice";
import { ProfileMenu } from "./profile-menu";
import { Brand } from "@/components/ui/brand";
import { useWorkspaces } from "@/features/workspaces/workspaces-provider";

const navigation = [
  { href: "/", label: "Visão geral", icon: "overview" },
  { href: "/quadros/", label: "Quadros", icon: "boards" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selected } = useWorkspaces();
  const workspaceName = selected?.name ?? "Seus projetos";
  const currentPage = pathname.startsWith("/quadros")
    ? "Quadros"
    : "Visão geral";
  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-workspace">
          <span className="workspace-monogram">tf</span>
          <div className="min-w-0">
            <span className="truncate" title={workspaceName}>
              {workspaceName}
            </span>
            <small>Workspace atual</small>
          </div>
        </div>
        <p className="nav-label">Navegação</p>
        <nav aria-label="Navegação principal" className="navigation">
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith("/quadros");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-2.5 text-sm text-muted">
            <Icon name="home" width="18" height="18" />
            <span
              className="hidden max-w-48 truncate sm:inline-block"
              title={workspaceName}
            >
              {workspaceName}
            </span>
            <Icon name="chevron" width="16" height="16" />
            <span className="text-ink">{currentPage}</span>
          </div>
          <ProfileMenu />
        </header>
        <main id="conteudo" tabIndex={-1} className="page-content">
          <ConnectionNotice />
          {children}
        </main>
        <footer className="main-footer">
          <span>Um pouco de organização. Um mundo de possibilidades.</span>
          <span>TaskFlow</span>
        </footer>
      </div>
    </div>
  );
}
