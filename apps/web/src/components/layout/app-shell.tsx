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
            <small>Um lugar para suas ideias</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
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
                {active && <span className="nav-active-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <svg
              width="74"
              height="48"
              viewBox="0 0 74 48"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 35C13 8 19 5 24 20s13 25 21 8S59 9 69 17M61 7l9 9-12 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>
              Menos ruído.
              <br />
              Mais fluxo.
            </p>
            <span>Um passo de cada vez.</span>
          </div>
          <div className="sidebar-foot">
            <span className="small-brand-mark" aria-hidden="true">
              ✳
            </span>{" "}
            Seu espaço, suas ideias.
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-2.5 text-xs text-muted">
            <Icon name="home" width="15" height="15" />
            <span
              className="hidden max-w-48 truncate sm:inline-block"
              title={workspaceName}
            >
              {workspaceName}
            </span>
            <Icon name="chevron" width="12" height="12" />
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
          <span>
            TaskFlow <span aria-hidden="true">↗</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
