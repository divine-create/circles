import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'zinc' | 'stone' | 'amber' | 'blue' | 'rose' | 'purple' | 'outline' | 'dark';
  dot?: boolean;
}

export function Badge({
  variant = 'stone',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    zinc: 'bg-zinc-100 text-zinc-900 border-zinc-300',
    dark: 'bg-zinc-950 text-white border-zinc-800',
    stone: 'bg-stone-100 text-stone-700 border-stone-200/70',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/70',
    blue: 'bg-sky-50 text-sky-800 border-sky-200/70',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/70',
    purple: 'bg-purple-50 text-purple-800 border-purple-200/70',
    outline: 'bg-transparent text-stone-600 border-stone-200',
  };

  const dotColors = {
    zinc: 'bg-zinc-800',
    dark: 'bg-white',
    stone: 'bg-stone-400',
    amber: 'bg-amber-500',
    blue: 'bg-sky-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    outline: 'bg-stone-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border tracking-wide uppercase ${variants[variant]} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
