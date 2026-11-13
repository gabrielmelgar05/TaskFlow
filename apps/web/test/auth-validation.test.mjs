import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAuthForm } from "../src/lib/auth-validation.ts";
const valid = {
  name: "Pessoa Teste",
  email: "teste@example.invalid",
  password: "Uma frase bem longa para entrar",
  confirmation: "Uma frase bem longa para entrar",
};
test("cadastro aceita frases-senha longas e dados válidos", () => {
  assert.deepEqual(validateAuthForm(valid, true), {});
});
test("cadastro informa erros nos campos obrigatórios", () => {
  const errors = validateAuthForm(
    {
      name: " ",
      email: "invalid",
      password: "curta",
      confirmation: "different",
    },
    true,
  );
  assert.deepEqual(Object.keys(errors), [
    "name",
    "email",
    "password",
    "confirmation",
  ]);
});
test("login exige e-mail e senha, sem antecipar a validação de credenciais", () => {
  assert.deepEqual(
    validateAuthForm({ ...valid, password: "incorreta" }, false),
    {},
  );
  assert.ok(validateAuthForm({ ...valid, password: "" }, false).password);
});
test("não altera a senha e rejeita valor acima de 128 caracteres", () => {
  assert.ok(
    validateAuthForm({ ...valid, password: "x".repeat(129) }, true).password,
  );
  const passphrase = "  uma frase com espaços mantidos  ";
  assert.deepEqual(
    validateAuthForm(
      { ...valid, password: passphrase, confirmation: passphrase },
      true,
    ),
    {},
  );
});
