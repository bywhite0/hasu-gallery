import React from 'react';

interface StatsCardProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'text-ink',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
};

export function StatsCard({ label, value, icon, variant = 'default' }: StatsCardProps) {
  const colorClass = variantStyles[variant];

  return (
    <div className="bg-surface border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className={colorClass}>{icon}</span>}
        <span className="text-sm text-ink-secondary">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${colorClass}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
