import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

const styles = {
  primary: "bg-ink text-white hover:bg-ink/85",
  secondary: "border border-line bg-surface text-ink hover:bg-paper",
};
type Variant = keyof typeof styles;
const base =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`${base} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={`${base} ${styles[variant]} ${className}`} {...props} />
  );
}
