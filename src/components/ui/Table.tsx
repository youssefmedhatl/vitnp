import { cn } from '@/lib/utils'

interface TableProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-sand',
        className
      )}
      {...props}
    >
      <table className="w-full" {...props}>
        {children}
      </table>
    </div>
  )
}

interface THeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function THead({ className, children, ...props }: THeadProps) {
  return (
    <thead className={cn('bg-bone/50 border-b border-sand', className)} {...props}>
      {children}
    </thead>
  )
}

interface TBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TBody({ className, children, ...props }: TBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  )
}

interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export function TR({ className, children, ...props }: TRProps) {
  return (
    <tr className={cn('border-b border-sand last:border-0', className)} {...props}>
      {children}
    </tr>
  )
}

interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export function TH({ className, children, ...props }: THProps) {
  return (
    <th
      className={cn(
        'px-6 py-3 text-start text-sm font-semibold text-ink',
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}

interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export function TD({ className, children, ...props }: TDProps) {
  return (
    <td
      className={cn('px-6 py-3 text-start text-sm text-ink', className)}
      {...props}
    >
      {children}
    </td>
  )
}
