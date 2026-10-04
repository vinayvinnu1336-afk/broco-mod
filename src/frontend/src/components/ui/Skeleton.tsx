import React, { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  circle = false,
  style,
  ...props
}) => {
  return (
    <div
      className={`animate-pulse bg-surface-200 ${
        circle ? 'rounded-full' : 'rounded-xl'
      } ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};
