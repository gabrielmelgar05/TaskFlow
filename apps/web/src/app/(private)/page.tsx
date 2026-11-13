import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { SectionCard } from "@/components/ui/section-card";
import { FlowIllustration } from "@/components/overview/flow-illustration";

const steps: {
  number: string;
  title: string;
  text: string;
  icon: IconName;
  color: string;
}[] = [
  {
    number: "01",
    title: "Um lugar para cada ideia",
    text: "Reúna seus projetos em quadros e veja tudo com mais clareza.",
    icon: "boards",
    color: "bg-pink",
  },
  {
    number: "02",
    title: "Cada passo conta",
    text: "Em breve, transforme grandes planos em pequenas tarefas.",
    icon: "layers",
    color: "bg-blue",
  },
  {
    number: "03",
    title: "Encontre seu ritmo",
    text: "Em breve, acompanhe o progresso e celebre o caminho.",
    icon: "target",
    color: "bg-yellow",
  },
];
export default function OverviewPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
          <h1>
            Visão geral<span className="text-[#9a6c8d]">.</span>
          </h1>
          <p>Mais clareza para suas ideias. Mais espaço para o que importa.</p>
        </div>
        <span className="page-heading-note">
          <Icon name="sparkles" width="16" height="16" /> O começo de algo bom
        </span>
      </div>
      <section className="welcome-card">
        <div className="relative z-10">
          <span className="welcome-label">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" /> UM NOVO COMEÇO
          </span>
          <h2>
            Organize o que importa.
            <br />
            No seu ritmo.
          </h2>
          <p>
            Das primeiras ideias aos próximos passos.
            <br className="hidden sm:block" /> Seu trabalho vai encontrar um bom
            lugar aqui.
          </p>
          <ButtonLink href="/quadros/" className="mt-5">
            Explorar meus quadros
            <Icon name="arrow" width="17" height="17" />
          </ButtonLink>
        </div>
        <FlowIllustration />
      </section>
      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          Grandes planos, pequenos passos
        </h2>
        <span className="text-xs text-muted">
          Um jeito mais leve de se organizar
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {steps.map((step) => (
          <article
            key={step.number}
            className={`${step.color} rounded-2xl px-5 py-5`}
          >
            <div className="mb-5 flex items-center justify-between">
              <Icon name={step.icon} width="23" height="23" />
              <span className="font-mono text-xs opacity-60">
                {step.number}
              </span>
            </div>
            <h3 className="text-[15px] font-semibold tracking-tight">
              {step.title}
            </h3>
            <p className="mt-2 max-w-72 text-[13px] leading-relaxed text-ink/75">
              {step.text}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <SectionCard
          title="Seus quadros"
          action={
            <Link
              href="/quadros/"
              className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              Ver quadros
              <Icon name="arrow" width="15" height="15" />
            </Link>
          }
        >
          <EmptyState
            title="Tudo começa com uma ideia"
            description="Este é o espaço dos seus futuros projetos. A criação de quadros estará disponível em breve."
          />
        </SectionCard>
        <aside className="idea-card">
          <span className="eyebrow">UM LEMBRETE GENTIL</span>
          <div className="idea-flower" aria-hidden="true">
            ✳
          </div>
          <h2>
            Você não precisa
            <br />
            fazer tudo de uma vez.
          </h2>
          <p>
            Um projeto, uma ideia, um passo.
            <br />O importante é ter por onde começar.
          </p>
          <div className="mt-auto flex items-center gap-2 pt-6 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9a6c8d]" /> Dê espaço
            ao seu processo.
          </div>
        </aside>
      </div>
    </>
  );
}
