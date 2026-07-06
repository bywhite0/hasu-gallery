import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-md border bg-surface px-3 text-base text-ink shadow-sm transition-colors md:text-sm",
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
