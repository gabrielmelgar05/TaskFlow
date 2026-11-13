import test from "node:test";
import assert from "node:assert/strict";
import { boardHref } from "../src/features/boards/types.ts";
test("link de atenção preserva a rota estática e codifica quadro/tarefa separadamente", () => {
  const href = boardHref("board&other=1", "task?x=2");
  const url = new URL(href, "https://taskflow.example");
  assert.equal(url.pathname, "/quadros/detalhes/");
  assert.equal(url.searchParams.get("id"), "board&other=1");
  assert.equal(url.searchParams.get("task"), "task?x=2");
  assert.equal(url.searchParams.size, 2);
  assert.equal(boardHref("one"), "/quadros/detalhes/?id=one");
});
