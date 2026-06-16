import { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-start justify-center pt-20">
      <div className="w-full max-w-md mx-auto px-4">
        <div className="bg-paper border border-ink rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
