import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

export interface PaginationNavProps {
  page: number;
  lastPage: number;
  /** e.g. (p) => `/items?page=${p}` */
  hrefFor: (page: number) => string;
  label: string;
  previousLabel: string;
  nextLabel: string;
  summary: string;
  className?: string;
}

/** Link-based, so it works without client JS. */
export function PaginationNav({
  page,
  lastPage,
  hrefFor,
  label,
  previousLabel,
  nextLabel,
  summary,
  className,
}: PaginationNavProps) {
  const linkClass = buttonVariants({ variant: 'outline', size: 'sm' });
  const disabledClass = cn(linkClass, 'pointer-events-none opacity-50');

  return (
    <nav
      aria-label={label}
      className={cn('flex items-center justify-between gap-4', className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          {previousLabel}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {previousLabel}
        </span>
      )}

      <span className="text-sm text-muted-foreground">{summary}</span>

      {page < lastPage ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          {nextLabel}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {nextLabel}
        </span>
      )}
    </nav>
  );
}
