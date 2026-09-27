'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, LockKeyhole } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { SafeAuthError } from '@/lib/auth-service';
import { validatePasswordReset } from '@/lib/auth-validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { preparePasswordRecovery, updatePassword, logout } = useAuth();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void preparePasswordRecovery(window.location.href).then(result => active && setValid(result));
    return () => { active = false; };
  }, [preparePasswordRecovery]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePasswordReset(password, confirmation);
    setErrors(validation.errors);
    if (!validation.data) return;
    setLoading(true);
    setMessage('');
    try {
      await updatePassword(validation.data.password);
      await logout();
      router.replace('/login?reset=success');
    } catch (error) {
      setMessage(error instanceof SafeAuthError ? error.message : 'Password reset is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Secure recovery" title="Choose a new password"
      description="Use a password you do not use elsewhere."
      footer={valid === false ? <Link href="/forgot-password">Request a new reset link</Link> : undefined}>
      {valid === null && <div className="auth-loading"><Spinner /><p>Checking your recovery link…</p></div>}
      {valid === false && <Feedback>This recovery link is invalid or has expired.</Feedback>}
      {valid && (
        <form className="auth-form" onSubmit={submit} noValidate>
          {message && <Feedback>{message}</Feedback>}
          <FormField id="password" label="New password" icon={KeyRound} type="password" autoComplete="new-password"
            autoFocus placeholder="Enter a new password" value={password} error={errors.password}
            onChange={event => setPassword(event.target.value)} />
          <FormField id="confirmation" label="Confirm new password" icon={LockKeyhole} type="password"
            autoComplete="new-password" placeholder="Repeat your new password" value={confirmation}
            error={errors.confirmPassword} onChange={event => setConfirmation(event.target.value)} />
          <Button className="button-full" type="submit" disabled={loading}>
            {loading ? <><Spinner /> Updating password…</> : 'Update password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
