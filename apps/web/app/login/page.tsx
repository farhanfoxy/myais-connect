'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { SafeAuthError, destinationForState } from '@/lib/auth-service';
import { validateLogin } from '@/lib/auth-validation';

export default function LoginPage() {
  const router = useRouter();
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(destinationForState(state));
  }, [router, state]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResetComplete(new URLSearchParams(window.location.search).get('reset') === 'success');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const validation = validateLogin(email, password);
    setErrors(validation.errors);
    if (!validation.data) return;
    setLoading(true);
    try {
      const next = await signIn(validation.data.email, validation.data.password);
      router.replace(destinationForState(next));
    } catch (error) {
      setMessage(error instanceof SafeAuthError ? error.message : 'Sign in is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to MyAIS"
      description="Continue to your membership workspace."
      footer={<>New to MyAIS Connect? <Link href="/register">Create an account</Link></>}
    >
      {resetComplete && <Feedback tone="success">Your password has been updated. You can now sign in.</Feedback>}
      {message && <Feedback>{message}</Feedback>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          id="email"
          label="Email address"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={errors.email}
          onChange={event => setEmail(event.target.value)}
        />
        <div>
          <div className="field-label-row">
            <span>Password</span>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <FormField
            id="password"
            label=""
            icon={LockKeyhole}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            error={errors.password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>
        <Button className="button-full" type="submit" disabled={loading}>
          {loading ? <><Spinner /> Signing in…</> : 'Sign in securely'}
        </Button>
      </form>
    </AuthLayout>
  );
}
