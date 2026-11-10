"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ConnectionNotice } from "./connection-notice";

const navigation = [
  { href: "/", label: "Visão geral", icon: "overview" },
  { href: "/quadros/", label: "Quadros", icon: "boards" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPage = pathname.startsWith("/quadros")
    ? "Quadros"
    : "Visão geral";
  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="TaskFlow — início">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          TaskFlow<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-workspace">
          <span className="workspace-monogram">tf</span>
          <div>
            <span>Meu workspace</span>
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
          <div className="flex items-center gap-2.5 text-xs text-muted">
            <Icon name="home" width="15" height="15" />
            <span className="hidden sm:inline">Meu workspace</span>
            <Icon name="chevron" width="12" height="12" />
            <span className="text-ink">{currentPage}</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9a6c8d]" />
            Versão inicial
          </span>
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
