"use client";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { useWorkspaces } from "@/features/workspaces/workspaces-provider";
import { ResourceError, ResourceLoading } from "./resource-state";
import { boardHref, type Board } from "./types";

export function BoardsSummary() {
  const workspaces = useWorkspaces();
  const workspace = workspaces.selected;
  const boards = useApiResource<Board[]>(
    workspace ? `/workspaces/${workspace.id}/boards` : null,
  );
  if (workspaces.loading || boards.loading) return <ResourceLoading />;
  if (workspaces.error || boards.error)
    return (
      <ResourceError
        message={workspaces.error ?? boards.error!}
        retry={() => {
          workspaces.reload();
          boards.reload();
        }}
      />
    );
  if (!boards.data?.length)
    return (
      <EmptyState
        title="Tudo começa com uma ideia"
        description="Crie um workspace e reúna seus projetos em quadros."
      >
        <ButtonLink href="/quadros/" variant="secondary">
          Abrir Quadros
        </ButtonLink>
      </EmptyState>
    );
  return (
    <div className="p-6">
      <p className="mb-4 text-sm text-muted">
        {boards.data.length}{" "}
        {boards.data.length === 1 ? "quadro em" : "quadros em"}{" "}
        <span className="font-medium text-ink">{workspace?.name}</span>
      </p>
      <ul className="recent-boards">
        {boards.data
          .slice(-3)
          .reverse()
          .map((board) => (
            <li key={board.id}>
              <Link href={boardHref(board.id)}>
                {board.name}
                <span aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
