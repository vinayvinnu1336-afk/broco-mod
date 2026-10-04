import React, { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="w-full overflow-x-auto rounded-xl border border-surface-200 bg-white">
        <table ref={ref} className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
          {children}
        </table>
      </div>
    );
  }
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <thead ref={ref} className={`bg-surface-50 border-b border-surface-200 ${className}`} {...props}>
        {children}
      </thead>
    );
  }
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tbody ref={ref} className={`divide-y divide-surface-200/80 bg-white ${className}`} {...props}>
        {children}
      </tbody>
    );
  }
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`hover:bg-surface-50/70 transition-colors ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-navy-600 select-none ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`px-4 py-3.5 text-sm text-navy-800 align-middle ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);
TableCell.displayName = 'TableCell';
