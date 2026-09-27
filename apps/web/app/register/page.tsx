'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail, UserRound } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { SafeAuthError, destinationForState } from '@/lib/auth-service';
import { validateRegistration } from '@/lib/auth-validation';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const validation = validateRegistration(form);
    setErrors(validation.errors);
    if (!validation.data) return;
    setLoading(true);
    try {
      const result = await register(validation.data);
      if (result.status === 'confirmation-required') setConfirmationEmail(result.email);
      else router.replace(destinationForState(result));
    } catch (error) {
      setMessage(error instanceof SafeAuthError ? error.message : 'Registration is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (confirmationEmail) {
    return (
      <AuthLayout
        eyebrow="One final step"
        title="Check your inbox"
        description="Confirm your email address to finish creating your account."
        footer={<Link href="/login">Return to sign in</Link>}
      >
        <div className="confirmation-state">
          <span className="confirmation-icon"><Mail size={25} /></span>
          <Feedback tone="success">We sent a secure confirmation link to <strong>{confirmationEmail}</strong>.</Feedback>
          <p>Open the link in the same browser to continue to MyAIS Connect. If it does not arrive, check your spam folder.</p>
        </div>
      </AuthLayout>
    );
  }

  const update = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));
  return (
    <AuthLayout
      eyebrow="Join the community"
      title="Create your account"
      description="Start your secure MyAIS membership journey."
      footer={<>Already have an account? <Link href="/login">Sign in</Link></>}
    >
      {message && <Feedback>{message}</Feedback>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField id="fullName" label="Full name" icon={UserRound} autoComplete="name"
          placeholder="As shown on your identification" value={form.fullName} error={errors.fullName}
          onChange={event => update('fullName', event.target.value)} />
        <FormField id="email" label="Email address" icon={Mail} type="email" autoComplete="email"
          placeholder="you@example.com" value={form.email} error={errors.email}
          onChange={event => update('email', event.target.value)} />
        <div className="form-grid-two">
          <FormField id="password" label="Password" icon={LockKeyhole} type="password" autoComplete="new-password"
            placeholder="Create a password" value={form.password} error={errors.password}
            onChange={event => update('password', event.target.value)} />
          <FormField id="confirmPassword" label="Confirm password" icon={LockKeyhole} type="password"
            autoComplete="new-password" placeholder="Repeat password" value={form.confirmPassword}
            error={errors.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} />
        </div>
        <Button className="button-full" type="submit" disabled={loading}>
          {loading ? <><Spinner /> Creating account…</> : 'Create MyAIS account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
