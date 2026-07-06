import { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-start justify-center py-10 text-ink sm:items-center sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
          <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
