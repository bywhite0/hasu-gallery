import type { TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-32 w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-base leading-6 text-ink shadow-sm transition-colors md:text-sm",
        "placeholder:text-ink-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-3 disabled:opacity-80",
        invalid ? "border-danger" : "border-border hover:border-ink-3",
        className,
      )}
      {...props}
    />
  );
}
