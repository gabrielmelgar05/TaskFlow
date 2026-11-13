import type { Metadata } from "next";
import { BoardsScreen } from "@/features/boards/boards-screen";
export const metadata: Metadata = { title: "Quadros | TaskFlow" };
export default function BoardsPage() {
  return <BoardsScreen />;
}
