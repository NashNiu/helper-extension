import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";
const styles: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
  ghost: "bg-transparent text-muted hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
  danger: "bg-transparent text-danger hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
