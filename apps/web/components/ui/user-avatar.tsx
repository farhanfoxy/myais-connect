'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function UserAvatar({ photoUrl, name, className }: Readonly<{
  photoUrl: string | null; name: string; className?: string;
}>) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.charAt(0).toUpperCase();
  return <span className={cn('user-avatar', className)}>{photoUrl && photoUrl !== failedUrl ?
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={photoUrl} alt={`Profile photo of ${name}`} onError={() => setFailedUrl(photoUrl)} /> : initial}</span>;
}
