import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: Readonly<{ className?: string }>) {
  return <LoaderCircle aria-hidden="true" className={cn('animate-spin', className)} />;
}
