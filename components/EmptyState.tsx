import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  illustration?: 'default' | 'search' | 'data' | 'note' | 'project';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  illustration = 'default'
}) => {
  const illustrationColors = {
    default: 'from-indigo-100 to-violet-100',
    search: 'from-blue-100 to-cyan-100',
    data: 'from-emerald-100 to-teal-100',
    note: 'from-amber-100 to-orange-100',
    project: 'from-purple-100 to-pink-100'
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      {/* 插画区域 */}
      <div className={`relative mb-8 w-32 h-32 rounded-3xl bg-gradient-to-br ${illustrationColors[illustration]} flex items-center justify-center shadow-lg shadow-slate-200/50`}>
        <div className="absolute inset-0 bg-white/20 rounded-3xl backdrop-blur-sm"></div>
        <Icon 
          size={48} 
          className="relative z-10 text-slate-600 opacity-80"
          strokeWidth={1.5}
        />
        {/* 装饰性光点 */}
        <div className="absolute top-2 right-2 w-3 h-3 bg-white/60 rounded-full blur-sm"></div>
        <div className="absolute bottom-3 left-3 w-2 h-2 bg-white/40 rounded-full blur-sm"></div>
      </div>

      {/* 文字内容 */}
      <div className="text-center max-w-md space-y-3">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 text-sm font-black uppercase tracking-widest"
        >
          {action.icon && <action.icon size={16} />}
          {action.label}
        </button>
      )}
    </div>
  );
};
