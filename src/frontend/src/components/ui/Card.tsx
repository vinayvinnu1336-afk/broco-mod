import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white rounded-2xl border border-surface-200 shadow-card transition-all duration-150 ${
          hoverEffect ? 'hover:border-surface-300 hover:shadow-elevated' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 py-4 border-b border-surface-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-base font-bold text-navy-900 leading-tight tracking-tight ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-xs text-navy-500 leading-relaxed mt-0.5 ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`p-5 sm:p-6 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 py-3.5 bg-surface-50 border-t border-surface-200 rounded-b-2xl flex items-center justify-between text-xs text-navy-600 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = 'CardFooter';
