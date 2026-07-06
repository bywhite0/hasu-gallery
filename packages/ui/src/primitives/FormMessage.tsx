import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface FormMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "info" | "success";
  action?: ReactNode;
}

export function FormMessage({
  variant = "error",
  action,
  className,
  children,
  ...props
}: FormMessageProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm leading-5",
        {
          "border-danger/30 bg-danger/10 text-danger": variant === "error",
          "border-info/30 bg-info/10 text-info": variant === "info",
          "border-success/30 bg-success/10 text-success": variant === "success",
        },
        className
      )}
      {...props}
    >
      <div>{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
