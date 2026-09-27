import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function FormField({
  label,
  error,
  icon: Icon,
  ...props
}: Readonly<InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon: LucideIcon;
}>) {
  const errorId = error ? `${props.id}-error` : undefined;
  return (
    <div className="field-group">
      <label htmlFor={props.id}>{label}</label>
      <div className="field-control">
        <Icon aria-hidden="true" size={18} />
        <Input {...props} invalid={Boolean(error)} aria-describedby={errorId} />
      </div>
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  );
}
