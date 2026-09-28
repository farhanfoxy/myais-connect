import Image from 'next/image';
import { cn } from '@/lib/utils';

export function BrandMark({ compact = false, full = false, inverse = false }: Readonly<{
  compact?: boolean; full?: boolean; inverse?: boolean;
}>) {
  if (full) {
    return <span className="brand-full-logo"><Image src="/brand/myais-connect-logo.png" width={1200} height={1350}
      sizes="(max-width: 760px) 150px, 190px" alt="MyAIS Connect" priority /></span>;
  }
  return (
    <div className={cn('brand-lockup', inverse && 'brand-lockup-inverse')} aria-label="MyAIS Connect">
      <Image className="brand-symbol-image" src="/brand/myais-connect-mark.png" width={1200} height={1200}
        sizes="40px" alt="" aria-hidden="true" priority />
      {!compact && (
        <span className="brand-wordmark">
          <strong>MyAIS</strong>
          <small>Connect</small>
        </span>
      )}
    </div>
  );
}
