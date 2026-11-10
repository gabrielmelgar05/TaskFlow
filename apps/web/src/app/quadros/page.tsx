import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { SectionCard } from "@/components/ui/section-card";

export const metadata: Metadata = { title: "Quadros | TaskFlow" };
export default function BoardsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">IDEIAS GANHAM ESPAÇO AQUI</p>
          <h1>
            Quadros<span className="text-[#9a6c8d]">.</span>
          </h1>
          <p>
            Um lugar para organizar seus projetos, do começo ao próximo passo.
          </p>
        </div>
        <span className="page-heading-note">
          <Icon name="boards" width="16" height="16" /> Seus futuros projetos
        </span>
      </div>
      <SectionCard
        title="Meus quadros"
        description="Seu espaço para transformar planos em ação."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[11px] text-muted">
            <Icon name="lock" width="12" height="12" /> Criação em breve
          </span>
        }
      >
        <EmptyState
          spacious
          title="Um espaço cheio de possibilidades"
          description="Seus quadros vão aparecer aqui. A criação e o gerenciamento de projetos estarão disponíveis em uma próxima etapa."
        >
          <ButtonLink href="/" variant="secondary">
            Voltar à visão geral
            <Icon name="arrow" width="16" height="16" />
          </ButtonLink>
        </EmptyState>
      </SectionCard>
      <aside className="mt-5 flex items-start gap-4 rounded-2xl bg-blue/60 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface/60">
          <Icon name="sparkles" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">
            Cada projeto tem seu próprio começo.
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink/75">
            Um quadro reúne as ideias e os próximos passos de um projeto.
            Estamos preparando esse espaço para você organizar tudo com
            simplicidade.
          </p>
        </div>
      </aside>
    </>
  );
}
