'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { SafeAuthError, destinationForState } from '@/lib/auth-service';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeCallback } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void completeCallback(window.location.href).then(state => {
      if (active) router.replace(destinationForState(state));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof SafeAuthError ? reason.message : 'We could not complete sign in.');
    });
    return () => { active = false; };
  }, [completeCallback, router]);

  return (
    <main className="centered-state-page">
      <div className="centered-state-card">
        <BrandMark />
        {error ? (
          <>
            <Feedback>{error}</Feedback>
            <Link className="button button-primary button-full" href="/login">Return to sign in</Link>
          </>
        ) : (
          <>
            <span className="state-icon state-icon-success"><CheckCircle2 /></span>
            <h1>Confirming your account</h1>
            <p>We’re securely connecting your MyAIS account.</p>
            <Spinner className="state-spinner" />
          </>
        )}
      </div>
    </main>
  );
}
