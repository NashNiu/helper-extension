import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";
const styles: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-transparent text-red-600 hover:bg-red-50",
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
