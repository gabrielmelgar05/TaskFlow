import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardScreen } from "@/features/boards/board-screen";
import { ResourceLoading } from "@/features/boards/resource-state";
export const metadata: Metadata = { title: "Quadro | TaskFlow" };
export default function BoardDetailPage() {
  return (
    <Suspense fallback={<ResourceLoading label="Carregando quadro…" />}>
      <BoardScreen />
    </Suspense>
  );
}
