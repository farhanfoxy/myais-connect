import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Feedback({
  tone = 'error',
  children,
}: Readonly<{ tone?: 'error' | 'success' | 'info'; children: React.ReactNode }>) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return (
    <div className={cn('feedback', `feedback-${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" size={18} />
      <div>{children}</div>
    </div>
  );
}
