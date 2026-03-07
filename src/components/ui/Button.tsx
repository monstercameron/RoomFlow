"use client";

import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantClasses: Record<string, string> = {
  primary: "bg-[var(--color-accent)] text-white border-transparent",
  outline: "border border-[var(--color-line)] bg-transparent text-[var(--color-ink)]",
  ghost: "bg-transparent text-[var(--color-ink)] border-transparent",
};

const sizeClasses: Record<string, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-3 text-lg",
};

export function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-2xl font-semibold transition focus-visible:outline focus-visible:outline-[var(--color-accent)] focus-visible:outline-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

