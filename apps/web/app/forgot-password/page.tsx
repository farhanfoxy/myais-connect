'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { validateEmail } from '@/lib/auth-validation';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateEmail(email);
    setError(validation.errors.email ?? '');
    if (!validation.data) return;
    setLoading(true);
    await requestPasswordReset(validation.data.email);
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthLayout eyebrow="Account recovery" title="Reset your password"
      description="We’ll send a secure recovery link to your email."
      footer={<Link href="/login"><ArrowLeft size={15} /> Back to sign in</Link>}>
      {sent ? (
        <div className="confirmation-state">
          <span className="confirmation-icon"><Mail size={25} /></span>
          <Feedback tone="success">If an account exists for that email, a password reset link is on its way.</Feedback>
          <p>For your security, the message is the same for every email address.</p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <FormField id="email" label="Email address" icon={Mail} type="email" autoComplete="email"
            autoFocus placeholder="you@example.com" value={email} error={error}
            onChange={event => setEmail(event.target.value)} />
          <Button className="button-full" type="submit" disabled={loading}>
            {loading ? <><Spinner /> Sending link…</> : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
