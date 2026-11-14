import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

const styles = {
  primary: "button-primary",
  secondary: "button-secondary",
  quiet: "button-quiet",
  destructive: "button-danger",
};
type Variant = keyof typeof styles;
const base = "tf-button";

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
