import Image from 'next/image';
import { cn } from '@/lib/utils';

export function OfficialMyaisMark({ className, decorative = false }: Readonly<{
  className?: string; decorative?: boolean;
}>) {
  return <span className={cn('official-myais-mark', className)}>
    <span className="official-myais-mark-crop"><Image src="/brand/myais-official-logo.jpg" width={1024} height={830}
      sizes="120px" alt={decorative ? '' : 'Association for Information Systems Malaysia Chapter (MyAIS)'}
      aria-hidden={decorative || undefined} /></span>
  </span>;
}

export function BrandMark({ compact = false, full = false, inverse = false }: Readonly<{
  compact?: boolean; full?: boolean; inverse?: boolean;
}>) {
  if (full) {
    return <span className="brand-full-logo"><Image src="/brand/myais-official-logo.jpg" width={1024} height={830}
      sizes="(max-width: 760px) 150px, 190px" alt="Association for Information Systems Malaysia Chapter (MyAIS)" priority /></span>;
  }
  return (
    <div className={cn('brand-lockup', inverse && 'brand-lockup-inverse')} aria-label="MyAIS Connect">
      <OfficialMyaisMark className="brand-symbol-image" decorative />
      {!compact && (
        <span className="brand-wordmark">
          <strong>MyAIS</strong>
          <small>Connect</small>
        </span>
      )}
    </div>
  );
}
