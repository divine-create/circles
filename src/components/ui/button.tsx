import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const variants = {
    primary:
      'bg-black text-white hover:bg-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)] border border-black rounded-xl',
    secondary:
      'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-xl hover:border-zinc-300',
    outline:
      'border border-zinc-200 bg-transparent text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900 rounded-xl hover:border-zinc-300',
    ghost:
      'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 rounded-xl',
    danger:
      'bg-red-600 text-white hover:bg-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.12)] border border-red-700 rounded-xl',
    gradient:
      'bg-gradient-to-r from-zinc-900 via-stone-900 to-black text-white hover:bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.2)] rounded-xl',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs rounded-lg',
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-5 py-2.5 text-sm font-semibold rounded-xl',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
