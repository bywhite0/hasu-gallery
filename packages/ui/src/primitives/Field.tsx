import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { FormMessage } from "./FormMessage";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm leading-5 text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <FormMessage id={`${htmlFor}-error`} className="mt-2">
          {error}
        </FormMessage>
      )}
    </div>
  );
}
