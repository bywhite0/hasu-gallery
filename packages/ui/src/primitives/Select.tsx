import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  invalid?: boolean;
  /** Visual size; `sm` is the compact variant for dense filter rows. */
  size?: "sm" | "md";
}

export function Select({ className, invalid, size = "md", children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-md border bg-surface text-ink shadow-sm transition-colors",
        size === "sm" ? "h-8 px-2.5 text-sm" : "h-10 px-3 text-base md:text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-3 disabled:opacity-80",
        invalid ? "border-danger" : "border-border hover:border-ink-3",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
