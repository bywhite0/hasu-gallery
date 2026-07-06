import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type StateTone = "neutral" | "info" | "danger";

export interface StateMessageProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: StateTone;
  className?: string;
}

const toneClassName: Record<StateTone, string> = {
  neutral: "border-ink/15 bg-surface text-ink",
  info: "border-info/30 bg-info/5 text-ink",
  danger: "border-danger/30 bg-danger/5 text-ink",
};

export function StateMessage({
  title,
  description,
  action,
  tone = "neutral",
  className,
}: StateMessageProps) {
  return (
    <section
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-md border px-6 py-10 text-center",
        toneClassName[tone],
        className,
      )}
    >
      <div className="max-w-xl space-y-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <div className="text-sm leading-6 text-ink-2">{description}</div>}
        {action && <div className="flex flex-wrap items-center justify-center gap-3 pt-2">{action}</div>}
      </div>
    </section>
  );
}

export function EmptyState(props: Omit<StateMessageProps, "tone">) {
  return <StateMessage tone="neutral" {...props} />;
}

export function ErrorState(props: Omit<StateMessageProps, "tone">) {
  return <StateMessage tone="danger" {...props} />;
}
