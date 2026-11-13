export function validateResourceName(value: string): string | undefined {
  const name = value.trim().replace(/ {2,}/g, " ");
  if (!name || [...name].length > 100)
    return "Use um nome de 1 a 100 caracteres.";
  if (!/^[-\p{L}\p{M}\p{N} .,'’!?&()+_:#@%/]+$/u.test(name))
    return "Use letras, números, espaços e pontuação simples no nome.";
}
