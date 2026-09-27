import { cn } from '@/lib/utils';

export function BrandMark({ compact = false, inverse = false }: Readonly<{ compact?: boolean; inverse?: boolean }>) {
  return (
    <div className={cn('brand-lockup', inverse && 'brand-lockup-inverse')} aria-label="MyAIS Connect">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand-wordmark">
          <strong>MyAIS</strong>
          <small>Connect</small>
        </span>
      )}
    </div>
  );
}
