import type { FieldErrors } from "./api";
export interface AuthFields {
  name: string;
  email: string;
  password: string;
  confirmation: string;
}
export function validateAuthForm(
  fields: AuthFields,
  register: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  if (register && !fields.name.trim())
    errors.name = "Informe seu nome completo.";
  else if (register && [...fields.name.trim()].length > 100)
    errors.name = "O nome deve ter até 100 caracteres.";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) ||
    fields.email.trim().length > 254
  )
    errors.email = "Informe um e-mail válido.";
  const length = [...fields.password].length;
  if (!length) errors.password = "Informe sua senha.";
  else if (register && length < 15)
    errors.password = "Use pelo menos 15 caracteres. Uma frase funciona bem.";
  else if (length > 128)
    errors.password = "A senha deve ter até 128 caracteres.";
  if (register && fields.confirmation !== fields.password)
    errors.confirmation = "As senhas precisam ser iguais.";
  return errors;
}
