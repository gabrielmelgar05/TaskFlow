"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import { ApiError, type FieldErrors } from "@/lib/api";
import { validateAuthForm } from "@/lib/auth-validation";
import { useAuth } from "./auth-provider";

function FormField({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  error,
  hint,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={password && visible ? "text" : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${name}-error` : hint ? `${name}-hint` : undefined
          }
          className={password ? "pr-12" : ""}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {visible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        )}
      </div>
      {error ? (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const auth = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setMessage("");
    const data = new FormData(event.currentTarget);
    const fields = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      confirmation: String(data.get("confirmation") ?? ""),
    };
    const nextErrors = validateAuthForm(fields, register);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = formRef.current?.elements.namedItem(
        Object.keys(nextErrors)[0],
      );
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const input = {
        email: fields.email.trim().toLowerCase(),
        password: fields.password,
      };
      if (register) await auth.register({ ...input, name: fields.name.trim() });
      else await auth.login(input);
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields);
        setMessage(error.message);
      } else setMessage("Não foi possível concluir. Tente novamente.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <Brand href="/login/" />
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">
          {register ? "UM NOVO COMEÇO" : "BEM-VINDO DE VOLTA"}
        </p>
        <h1 id="auth-title">
          {register ? "Dê espaço às suas ideias." : "Bom ter você por aqui."}
        </h1>
        <p className="auth-description">
          {register
            ? "Crie sua conta e encontre seu próprio ritmo."
            : "Entre na sua conta para continuar no seu ritmo."}
        </p>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          noValidate
          aria-busy={pending}
          className="mt-7 space-y-5"
        >
          <fieldset disabled={pending} className="space-y-5">
            {register && (
              <FormField
                name="name"
                label="Nome completo"
                autoComplete="name"
                placeholder="Como podemos chamar você?"
                error={errors.name}
              />
            )}
            <FormField
              name="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              error={errors.email}
            />
            <FormField
              name="password"
              label="Senha"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={
                register ? "Crie uma frase-senha" : "Digite sua senha"
              }
              hint={
                register
                  ? "De 15 a 128 caracteres. Pode usar espaços e frases longas."
                  : undefined
              }
              error={errors.password}
            />
            {register && (
              <FormField
                name="confirmation"
                label="Confirmar senha"
                type="password"
                autoComplete="new-password"
                placeholder="Digite a senha novamente"
                error={errors.confirmation}
              />
            )}
          </fieldset>
          {message && (
            <div role="alert" className="form-alert">
              {message}
            </div>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <>
                <span
                  className="loading-ring loading-ring-small"
                  aria-hidden="true"
                />
                {register ? "Criando sua conta…" : "Entrando…"}
              </>
            ) : (
              <>{register ? "Criar minha conta" : "Entrar"}</>
            )}
          </Button>
        </form>
        <p className="auth-switch">
          {register ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
          <Link href={register ? "/login/" : "/cadastro/"}>
            {register ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </section>
      <p className="auth-footer">
        Seu espaço, suas ideias. Um passo de cada vez.
      </p>
    </main>
  );
}
