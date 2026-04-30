import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  isLoading?: boolean;
  description?: string;
  colorTheme?: 'primary' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo' | 'violet' | 'slate';
}

const themeClasses = {
  primary: 'bg-gradient-to-br from-blue-50 to-indigo-100/80 text-blue-950 border-white/60',
  emerald: 'bg-gradient-to-br from-emerald-50 to-teal-100/80 text-emerald-950 border-white/60',
  amber: 'bg-gradient-to-br from-amber-50 to-orange-100/80 text-amber-950 border-white/60',
  rose: 'bg-gradient-to-br from-rose-50 to-pink-100/80 text-rose-950 border-white/60',
  cyan: 'bg-gradient-to-br from-cyan-50 to-sky-100/80 text-cyan-950 border-white/60',
  indigo: 'bg-gradient-to-br from-indigo-50 to-violet-100/80 text-indigo-950 border-white/60',
  violet: 'bg-gradient-to-br from-violet-50 to-fuchsia-100/80 text-violet-950 border-white/60',
  slate: 'bg-gradient-to-br from-slate-50 to-gray-100/80 text-slate-900 border-white/60',
};

const iconThemeClasses = {
  primary: 'bg-blue-600/10 text-blue-600',
  emerald: 'bg-emerald-600/10 text-emerald-600',
  amber: 'bg-amber-600/10 text-amber-600',
  rose: 'bg-rose-600/10 text-rose-600',
  cyan: 'bg-cyan-600/10 text-cyan-600',
  indigo: 'bg-indigo-600/10 text-indigo-600',
  violet: 'bg-violet-600/10 text-violet-600',
  slate: 'bg-slate-600/10 text-slate-600',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  description,
  colorTheme = 'slate',
}: StatCardProps) {
  const containerClass = themeClasses[colorTheme] || themeClasses.slate;
  const iconContainerClass = iconThemeClasses[colorTheme] || iconThemeClasses.slate;

  return (
    <div 
      className={`relative w-full min-h-[100px] rounded-[16px] border p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg shadow-sm backdrop-blur-md overflow-hidden flex flex-col justify-between ${containerClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-70 leading-tight">
          {label}
        </h3>
        {Icon && (
          <div className={`flex-shrink-0 p-1.5 rounded-lg backdrop-blur-sm ${iconContainerClass}`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        )}
      </div>
      
      <div className="mt-2 flex-grow flex flex-col justify-end">
        {isLoading ? (
          <div className="h-6 w-20 animate-pulse rounded-md bg-black/10" />
        ) : (
          <div className="w-full">
            <p 
              className="text-sm sm:text-base md:text-lg lg:text-xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {value}
            </p>
            {description && (
              <p className="mt-1 text-[10px] sm:text-xs font-medium opacity-60 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
