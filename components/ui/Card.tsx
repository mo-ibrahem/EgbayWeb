import React from 'react';

/**
 * The default surface container -- white panel, hairline border, single
 * restrained shadow. Use this instead of ad hoc `bg-white rounded-*
 * border shadow-*` combinations scattered inline.
 */
export default function Card({
  className = '',
  padding = 'p-5',
  hover = false,
  children,
  ...rest
}: {
  className?: string;
  padding?: string;
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-card ${hover ? 'card-hover' : ''} ${padding} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
