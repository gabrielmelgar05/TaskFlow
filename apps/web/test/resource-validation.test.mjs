import test from "node:test";
import assert from "node:assert/strict";
import { validateResourceName } from "../src/lib/resource-validation.ts";
test("nomes aceitam acentos, números e pontuação simples", () => {
  for (const value of [
    "Projeto São João",
    "  Produto 2026 —".replace("—", "-"),
    "Pesquisa & Design (v2)",
    "A",
    "x".repeat(100),
  ])
    assert.equal(validateResourceName(value), undefined);
});
test("nomes rejeitam vazio, excesso, controles e marcação", () => {
  for (const value of [
    "",
    "   ",
    "x".repeat(101),
    "<script>alert(1)</script>",
    "linha\nquebrada",
    "tab\tno meio",
    "zero\u0000",
    "invisível\u200b",
  ])
    assert.ok(validateResourceName(value));
});
