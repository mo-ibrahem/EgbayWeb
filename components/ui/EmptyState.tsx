import React from 'react';

/**
 * One consistent empty state: icon, heading, one line of guidance, an
 * optional action. Used for "no search results," "no orders yet," "no
 * listings yet," "no notifications" -- anywhere a list can legitimately
 * be empty. Never leave a blank area with no explanation.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center py-14 px-6 ${className}`}>
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action}
    </div>
  );
}
