'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CloudOff } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { protectedRouteDecision } from '@/lib/auth-service';
import { canReviewApplications, canonicalDestination, roleFamily } from '@/lib/roles';

export function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, refresh } = useAuth();
  const decision = protectedRouteDecision(state);

  useEffect(() => {
    if (decision === 'login') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (decision === 'deny') router.replace('/access-denied');
    if (state.status === 'authenticated') {
      const family = roleFamily(state.user.role);
      if ((pathname.startsWith('/admin') && family !== 'committee') ||
          (pathname.startsWith('/dashboard') && family !== 'member')) {
        router.replace(canonicalDestination(state.user.role));
      }
      if (family === 'committee' && pathname.startsWith('/admin/applications') && !canReviewApplications(state.user.role)) {
        router.replace('/admin');
      }
    }
  }, [decision, pathname, router, state]);

  if (decision === 'wait' || decision === 'login' || decision === 'deny') {
    return (
      <main className="app-loading-screen"><BrandMark /><div className="skeleton-stack"><span /><span /><span /></div>
        <div className="loading-label"><Spinner /> Securing your workspace…</div></main>
    );
  }
  if (state.status === 'api-unavailable') {
    return (
      <main className="centered-state-page">
        <div className="centered-state-card"><BrandMark /><span className="state-icon"><CloudOff /></span>
          <h1>We can’t reach MyAIS right now</h1><p>{state.message}</p>
          <Button onClick={() => void refresh()}>Try again</Button></div>
      </main>
    );
  }
  if (state.status !== 'authenticated') return null;
  const family = roleFamily(state.user.role);
  if ((pathname.startsWith('/admin') && family !== 'committee') ||
      (pathname.startsWith('/dashboard') && family !== 'member')) return null;
  if (pathname.startsWith('/admin/applications') && !canReviewApplications(state.user.role)) return null;
  return children;
}
