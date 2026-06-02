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
  primary: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500/20 shadow-md shadow-blue-500/10',
  emerald: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-500/20 shadow-md shadow-emerald-500/10',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-500/20 shadow-md shadow-amber-500/10',
  rose: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-rose-500/20 shadow-md shadow-rose-500/10',
  cyan: 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white border-cyan-500/20 shadow-md shadow-cyan-500/10',
  indigo: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-500/20 shadow-md shadow-indigo-500/10',
  violet: 'bg-gradient-to-br from-purple-600 to-indigo-800 text-white border-purple-500/20 shadow-md shadow-purple-500/10',
  slate: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white border-slate-600/20 shadow-md shadow-slate-700/10',
};

const iconThemeClasses = {
  primary: 'bg-white/20 text-white shadow-inner',
  emerald: 'bg-white/20 text-white shadow-inner',
  amber: 'bg-white/20 text-white shadow-inner',
  rose: 'bg-white/20 text-white shadow-inner',
  cyan: 'bg-white/20 text-white shadow-inner',
  indigo: 'bg-white/20 text-white shadow-inner',
  violet: 'bg-white/20 text-white shadow-inner',
  slate: 'bg-white/20 text-white shadow-inner',
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
